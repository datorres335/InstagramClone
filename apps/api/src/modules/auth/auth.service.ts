import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import type {
  ChangeEmailInput,
  ChangePasswordInput,
  DeleteAccountInput,
  LoginInput,
  LogoutInput,
  RegisterInput,
} from '@instagram-clone/validation';
import { Prisma, type User } from '@instagram-clone/prisma-client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  IncorrectPasswordException,
  InvalidCredentialsException,
} from './auth.exceptions';
import { PasswordService } from './password.service';
import {
  type AccessToken,
  type TokenMeta,
  TokensService,
} from './tokens.service';

/**
 * A fixed, valid argon2id hash with no corresponding real password. Verified
 * against on every login where no matching user was found, so a
 * nonexistent-account login takes the same time as a wrong-password one —
 * without this, response timing would leak whether an email/username exists.
 * (Generated once via `argon2.hash('not-a-real-password')`; the value itself
 * is not a secret — it corresponds to no account.)
 */
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c8y6RxD4jofLzikvpNKQ5w$3H5q6q3Qh/lPRVXcnh3wDS+xNqxMOWnV4vG/rZ7Vy8Q';

export interface SessionTokens extends AccessToken {
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly tokens: TokensService,
  ) {}

  async register(
    input: RegisterInput,
    meta: TokenMeta,
  ): Promise<{ user: User } & SessionTokens> {
    const passwordHash = await this.password.hash(input.password);

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          email: input.email,
          username: input.username,
          passwordHash,
          fullName: input.fullName,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email or username is already taken.');
      }
      throw error;
    }

    return this.issueSession(user, meta);
  }

  async login(
    input: LoginInput,
    meta: TokenMeta,
  ): Promise<{ user: User } & SessionTokens> {
    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { email: input.emailOrUsername },
          { username: input.emailOrUsername },
        ],
      },
    });

    // Run verify() unconditionally, even with no user, against a fixed
    // dummy hash — keeps timing independent of account existence.
    const passwordValid = await this.password.verify(
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
      input.password,
    );

    if (!user || !passwordValid) {
      throw new InvalidCredentialsException();
    }

    return this.issueSession(user, meta);
  }

  async refresh(
    presentedToken: string,
    meta: TokenMeta,
  ): Promise<SessionTokens> {
    const rotated = await this.tokens.rotate(presentedToken, meta);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: rotated.userId },
    });
    const accessToken = await this.tokens.issueAccessToken(user);

    return { ...accessToken, refreshToken: rotated.refreshToken };
  }

  /**
   * Idempotent: a missing/unknown/already-revoked token is treated the same
   * as success — "make sure I'm logged out" is already true either way.
   */
  async logout(
    presentedToken: string | undefined,
    options: Pick<LogoutInput, 'allDevices'>,
  ): Promise<void> {
    if (!presentedToken) return;
    await this.tokens.logout(presentedToken, options.allDevices ?? false);
  }

  async getSessionUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    return user;
  }

  /**
   * `POST /me/change-password` (docs/API.md §13, docs/FEATURES.md #17).
   * Bumps `tokenVersion`, which immediately invalidates every outstanding
   * access token system-wide — including the *calling* session's own, since
   * `JwtAuthGuard` checks the current DB value on every request, not just
   * at issuance (`resolve-authenticated-user.ts`). Also revokes every
   * existing refresh-token family (not just bumping `tokenVersion`): a
   * `tokenVersion` bump alone wouldn't stop another device from silently
   * minting a fresh access token via its still-valid refresh token
   * (`TokensService.refresh` doesn't check `tokenVersion` — it just rotates
   * and re-reads the user row), which would defeat the point of a password
   * change forcing a real re-login elsewhere. The calling session gets a
   * brand-new token pair in the response so it keeps working without one.
   */
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    meta: TokenMeta,
  ): Promise<SessionTokens> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const valid = await this.password.verify(
      user.passwordHash,
      input.currentPassword,
    );
    if (!valid) {
      throw new IncorrectPasswordException();
    }

    const newPasswordHash = await this.password.hash(input.newPassword);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash, tokenVersion: { increment: 1 } },
    });
    await this.tokens.revokeAllForUser(userId);

    return this.issueSessionTokens(updated, meta);
  }

  /**
   * `POST /me/change-email` (docs/API.md §13) — `currentPassword`-confirmed,
   * same as `changePassword` above. Deliberately does *not* bump
   * `tokenVersion` or revoke sessions — only a password change is documented
   * to do that (docs/FEATURES.md #17 describes this for password changes
   * specifically, not email changes).
   */
  async changeEmail(userId: string, input: ChangeEmailInput): Promise<User> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const valid = await this.password.verify(
      user.passwordHash,
      input.currentPassword,
    );
    if (!valid) {
      throw new IncorrectPasswordException();
    }

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { email: input.newEmail },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email is already taken.');
      }
      throw error;
    }
  }

  /**
   * `DELETE /me` (docs/API.md §4/§13) — soft-deletes (sets `deletedAt`) and
   * revokes every refresh-token family. No `tokenVersion` bump is needed for
   * the access-token side: `resolveAuthenticatedUser` already rejects any
   * token belonging to a `deletedAt`-set user on its next check
   * (docs/DATABASE.md §7), the same mechanism that already protects
   * `getSessionUser`/`login` above.
   */
  async deleteAccount(
    userId: string,
    input: DeleteAccountInput,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const valid = await this.password.verify(
      user.passwordHash,
      input.currentPassword,
    );
    if (!valid) {
      throw new IncorrectPasswordException();
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
    await this.tokens.revokeAllForUser(userId);
  }

  private async issueSessionTokens(
    user: Pick<User, 'id' | 'tokenVersion'>,
    meta: TokenMeta,
  ): Promise<SessionTokens> {
    const [accessToken, issuedRefreshToken] = await Promise.all([
      this.tokens.issueAccessToken(user),
      this.tokens.issueRefreshToken(user.id, meta),
    ]);

    return { ...accessToken, refreshToken: issuedRefreshToken.refreshToken };
  }

  private async issueSession(
    user: User,
    meta: TokenMeta,
  ): Promise<{ user: User } & SessionTokens> {
    const tokens = await this.issueSessionTokens(user, meta);
    return { user, ...tokens };
  }
}

import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import type {
  LoginInput,
  LogoutInput,
  RegisterInput,
} from '@instagram-clone/validation';
import { Prisma, type User } from '@instagram-clone/prisma-client';

import { PrismaService } from '../../prisma/prisma.service';
import { InvalidCredentialsException } from './auth.exceptions';
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

  private async issueSession(
    user: User,
    meta: TokenMeta,
  ): Promise<{ user: User } & SessionTokens> {
    const [accessToken, issuedRefreshToken] = await Promise.all([
      this.tokens.issueAccessToken(user),
      this.tokens.issueRefreshToken(user.id, meta),
    ]);

    return {
      user,
      ...accessToken,
      refreshToken: issuedRefreshToken.refreshToken,
    };
  }
}

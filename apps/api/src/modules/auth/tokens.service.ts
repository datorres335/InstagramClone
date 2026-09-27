import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import ms from 'ms';

import { type ApiEnv } from '@instagram-clone/config';

import { API_ENV } from '../../config/config.module';
import { PrismaService } from '../../prisma/prisma.service';
import {
  InvalidRefreshTokenException,
  RefreshTokenReusedException,
} from './auth.exceptions';
import type { JwtPayload } from './jwt-payload';

export interface TokenMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface AccessToken {
  accessToken: string;
  accessTokenExpiresAt: string;
}

export interface IssuedRefreshToken {
  refreshToken: string;
  expiresAt: Date;
}

export interface RotatedRefreshToken extends IssuedRefreshToken {
  userId: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Access-token issuance and refresh-token lifecycle (mint, rotate,
 * revoke) — docs/ARCHITECTURE.md §7. Kept separate from `AuthService` so the
 * rotation/reuse-detection logic (the genuinely tricky part) is isolated
 * and independently testable from the register/login/logout orchestration.
 */
@Injectable()
export class TokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  async issueAccessToken(user: {
    id: string;
    tokenVersion: number;
  }): Promise<AccessToken> {
    const payload: JwtPayload = {
      sub: user.id,
      tokenVersion: user.tokenVersion,
    };
    const accessToken = await this.jwt.signAsync(payload);
    const accessTokenExpiresAt = new Date(
      Date.now() + ms(this.env.JWT_ACCESS_TOKEN_TTL as ms.StringValue),
    ).toISOString();

    return { accessToken, accessTokenExpiresAt };
  }

  /** Starts a brand-new token family — used by register and login. */
  async issueRefreshToken(
    userId: string,
    meta: TokenMeta,
  ): Promise<IssuedRefreshToken> {
    const familyId = randomUUID();
    const { refreshToken, expiresAt } = await this.createRow(
      this.prisma,
      userId,
      familyId,
      meta,
    );
    return { refreshToken, expiresAt };
  }

  /**
   * Validates a presented refresh token and rotates it: the old row is
   * revoked, a new one is created in the same family, atomically.
   *
   * - Unknown or expired token → `InvalidRefreshTokenException` (a normal,
   *   unremarkable event; no family revocation).
   * - A token that was *already* rotated away (or logged out) being
   *   presented again → `RefreshTokenReusedException`, and the entire
   *   family is revoked (docs/ARCHITECTURE.md §7's reuse-detection design).
   */
  async rotate(
    presentedToken: string,
    meta: TokenMeta,
  ): Promise<RotatedRefreshToken> {
    const tokenHash = hashToken(presentedToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!existing) {
      throw new InvalidRefreshTokenException();
    }

    if (existing.revokedAt) {
      await this.revokeFamily(existing.familyId);
      throw new RefreshTokenReusedException();
    }

    if (existing.expiresAt.getTime() < Date.now()) {
      throw new InvalidRefreshTokenException();
    }

    const { refreshToken, expiresAt } = await this.prisma.$transaction(
      async (tx) => {
        const created = await this.createRow(
          tx,
          existing.userId,
          existing.familyId,
          meta,
        );
        await tx.refreshToken.update({
          where: { id: existing.id },
          data: {
            revokedAt: new Date(),
            replacedByTokenHash: hashToken(created.refreshToken),
          },
        });
        return created;
      },
    );

    return { userId: existing.userId, refreshToken, expiresAt };
  }

  /**
   * Logout: revokes the presented token's whole family (every token ever
   * rotated from the same login — docs/FEATURES.md #2), or every family the
   * user has if `allDevices`. Idempotent by design — an unknown or
   * already-revoked token is a no-op, not an error, since "make sure I'm
   * logged out" is already true either way.
   */
  async logout(presentedToken: string, allDevices: boolean): Promise<void> {
    const tokenHash = hashToken(presentedToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!existing) return;

    if (allDevices) {
      await this.revokeAllForUser(existing.userId);
    } else {
      await this.revokeFamily(existing.familyId);
    }
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Prisma's client type and its `$transaction` callback's `tx` type share this shape. */
  private async createRow(
    client: Pick<PrismaService, 'refreshToken'>,
    userId: string,
    familyId: string,
    meta: TokenMeta,
  ): Promise<IssuedRefreshToken> {
    const refreshToken = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + ms(this.env.REFRESH_TOKEN_TTL as ms.StringValue),
    );

    await client.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash,
        expiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });

    return { refreshToken, expiresAt };
  }
}

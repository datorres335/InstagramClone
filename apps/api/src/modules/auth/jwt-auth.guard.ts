import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from './jwt-payload';

export interface AuthenticatedUser {
  id: string;
  tokenVersion: number;
}

/**
 * Verifies the `Authorization: Bearer <token>` header and attaches the
 * resulting user to `request.user` (read via `@CurrentUser()`).
 *
 * A hand-written guard, not a Passport strategy: this API has exactly one
 * auth mechanism (Bearer JWT) — Passport's multi-strategy abstraction earns
 * its two extra dependencies (`@nestjs/passport`, `passport-jwt`) only once
 * a second strategy is genuinely needed, per `CLAUDE.md`'s "don't introduce
 * another library if the existing stack already solves the problem
 * adequately."
 *
 * Checks `tokenVersion` against the *current* value on the user row, not
 * just JWT signature/expiry — this is what makes bumping `tokenVersion`
 * (e.g. on a future password change) actually invalidate outstanding
 * access tokens without needing a server-side allowlist
 * (docs/ARCHITECTURE.md §7).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token.');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, tokenVersion: true, deletedAt: true },
    });

    if (!user || user.deletedAt || user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    (request as Request & { user: AuthenticatedUser }).user = {
      id: user.id,
      tokenVersion: user.tokenVersion,
    };

    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return undefined;
    return header.slice('Bearer '.length).trim() || undefined;
  }
}

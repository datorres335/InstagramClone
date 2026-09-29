import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from './jwt-auth.guard';
import type { JwtPayload } from './jwt-payload';

function extractBearerToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length).trim() || undefined;
}

/**
 * The shared verify-token-and-look-up-user logic behind both `JwtAuthGuard`
 * (rejects when this returns `null`) and `OptionalAuthGuard` (proceeds
 * either way) — one place implementing "what makes a bearer token valid,"
 * so the two guards can't silently drift on that definition.
 */
export async function resolveAuthenticatedUser(
  request: Request,
  jwt: JwtService,
  prisma: PrismaService,
): Promise<AuthenticatedUser | null> {
  const token = extractBearerToken(request);
  if (!token) return null;

  let payload: JwtPayload;
  try {
    payload = await jwt.verifyAsync<JwtPayload>(token);
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, tokenVersion: true, deletedAt: true },
  });

  if (!user || user.deletedAt || user.tokenVersion !== payload.tokenVersion) {
    return null;
  }

  return { id: user.id, tokenVersion: user.tokenVersion };
}

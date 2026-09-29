import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from './jwt-auth.guard';
import { resolveAuthenticatedUser } from './resolve-authenticated-user';

/**
 * For routes that behave differently when authenticated but don't require it
 * — `GET /users/:username` (docs/API.md §4) is the first: `isFollowedByMe`
 * is only computed for a signed-in viewer, but the profile itself is public.
 *
 * A missing token, an expired one, or one that otherwise fails
 * `JwtAuthGuard`'s checks are all treated the same way here: proceed
 * unauthenticated (`request.user` left unset) rather than rejecting the
 * request — this guard never throws. Use `@OptionalCurrentUser()` to read
 * the result.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = await resolveAuthenticatedUser(request, this.jwt, this.prisma);

    if (user) {
      (request as Request & { user: AuthenticatedUser }).user = user;
    }

    return true;
  }
}

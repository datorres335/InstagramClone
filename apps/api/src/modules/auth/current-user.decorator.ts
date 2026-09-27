import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedUser } from './jwt-auth.guard';

/** The user `JwtAuthGuard` attached to the request — use only on routes guarded by it. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    return ctx.switchToHttp().getRequest().user as AuthenticatedUser;
  },
);

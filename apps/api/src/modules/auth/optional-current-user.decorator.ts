import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedUser } from './jwt-auth.guard';

/** The user `OptionalAuthGuard` attached to the request, if any — use only on routes guarded by it. */
export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    return ctx.switchToHttp().getRequest().user as
      | AuthenticatedUser
      | undefined;
  },
);

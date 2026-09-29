import type { ExecutionContext } from '@nestjs/common';

import { OptionalAuthGuard } from './optional-auth.guard';

function createContext(headers: Record<string, string> = {}) {
  const request: { headers: Record<string, string>; user?: unknown } = {
    headers,
  };
  return {
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext,
    request,
  };
}

function createGuard() {
  const jwt = { verifyAsync: jest.fn() };
  const prisma = { user: { findUnique: jest.fn() } };
  const guard = new OptionalAuthGuard(jwt as never, prisma as never);
  return { guard, jwt, prisma };
}

describe('OptionalAuthGuard', () => {
  it('allows a request with no Authorization header, leaving request.user unset', async () => {
    const { guard } = createGuard();
    const { context, request } = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('allows a request with an invalid token, leaving request.user unset', async () => {
    const { guard, jwt } = createGuard();
    jwt.verifyAsync.mockRejectedValue(new Error('invalid signature'));
    const { context, request } = createContext({
      authorization: 'Bearer bad.token',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('allows a request with an expired-tokenVersion token, leaving request.user unset', async () => {
    const { guard, jwt, prisma } = createGuard();
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', tokenVersion: 0 });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tokenVersion: 1,
      deletedAt: null,
    });
    const { context, request } = createContext({
      authorization: 'Bearer stale.token',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('attaches the user to the request for a valid token', async () => {
    const { guard, jwt, prisma } = createGuard();
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', tokenVersion: 0 });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tokenVersion: 0,
      deletedAt: null,
    });
    const { context, request } = createContext({
      authorization: 'Bearer good.token',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'user-1', tokenVersion: 0 });
  });
});

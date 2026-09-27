import type { ExecutionContext } from '@nestjs/common';

import { JwtAuthGuard } from './jwt-auth.guard';

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
  const guard = new JwtAuthGuard(jwt as never, prisma as never);
  return { guard, jwt, prisma };
}

describe('JwtAuthGuard', () => {
  it('rejects a request with no Authorization header', async () => {
    const { guard } = createGuard();
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Missing bearer token.',
    );
  });

  it('rejects a malformed Authorization header', async () => {
    const { guard } = createGuard();
    const { context } = createContext({ authorization: 'Basic something' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Missing bearer token.',
    );
  });

  it('rejects a token that fails JWT verification', async () => {
    const { guard, jwt } = createGuard();
    jwt.verifyAsync.mockRejectedValue(new Error('invalid signature'));
    const { context } = createContext({ authorization: 'Bearer bad.token' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Invalid or expired access token.',
    );
  });

  it('rejects a token for a user that no longer exists', async () => {
    const { guard, jwt, prisma } = createGuard();
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', tokenVersion: 0 });
    prisma.user.findUnique.mockResolvedValue(null);
    const { context } = createContext({ authorization: 'Bearer good.token' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Invalid or expired access token.',
    );
  });

  it('rejects a token for a soft-deleted user', async () => {
    const { guard, jwt, prisma } = createGuard();
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', tokenVersion: 0 });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tokenVersion: 0,
      deletedAt: new Date(),
    });
    const { context } = createContext({ authorization: 'Bearer good.token' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Invalid or expired access token.',
    );
  });

  it('rejects a token whose tokenVersion no longer matches the user (e.g. after a password change)', async () => {
    const { guard, jwt, prisma } = createGuard();
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', tokenVersion: 0 });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      tokenVersion: 1,
      deletedAt: null,
    });
    const { context } = createContext({ authorization: 'Bearer good.token' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Invalid or expired access token.',
    );
  });

  it('allows a valid token and attaches the user to the request', async () => {
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

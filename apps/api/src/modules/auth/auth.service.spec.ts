import { ConflictException, UnauthorizedException } from '@nestjs/common';

import { Prisma } from '@instagram-clone/prisma-client';

import { AuthService } from './auth.service';
import { InvalidCredentialsException } from './auth.exceptions';

const fakeUser = {
  id: 'user-1',
  email: 'alice@example.com',
  username: 'alice',
  passwordHash: 'stored-hash',
  fullName: null,
  bio: null,
  websiteUrl: null,
  isPrivate: false,
  tokenVersion: 0,
  emailVerifiedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
};

function createDeps() {
  const prisma = {
    user: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };
  const password = { hash: jest.fn(), verify: jest.fn() };
  const tokens = {
    issueAccessToken: jest.fn(),
    issueRefreshToken: jest.fn(),
    rotate: jest.fn(),
    logout: jest.fn(),
  };

  const service = new AuthService(
    prisma as never,
    password as never,
    tokens as never,
  );
  return { service, prisma, password, tokens };
}

const accessToken = {
  accessToken: 'jwt',
  accessTokenExpiresAt: '2026-01-01T00:15:00.000Z',
};
const issuedRefreshToken = {
  refreshToken: 'raw-refresh-token',
  expiresAt: new Date(),
};

describe('AuthService', () => {
  describe('register', () => {
    it('hashes the password, creates the user, and issues a session', async () => {
      const { service, prisma, password, tokens } = createDeps();
      password.hash.mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue(fakeUser);
      tokens.issueAccessToken.mockResolvedValue(accessToken);
      tokens.issueRefreshToken.mockResolvedValue(issuedRefreshToken);

      const result = await service.register(
        {
          email: 'alice@example.com',
          username: 'alice',
          password: 'password123',
        },
        {},
      );

      expect(password.hash).toHaveBeenCalledWith('password123');
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ passwordHash: 'hashed-password' }),
        }),
      );
      expect(result).toEqual({
        user: fakeUser,
        ...accessToken,
        refreshToken: 'raw-refresh-token',
      });
    });

    it('maps a unique-constraint violation to ConflictException', async () => {
      const { service, prisma, password } = createDeps();
      password.hash.mockResolvedValue('hashed-password');
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.10.0',
        }),
      );

      await expect(
        service.register(
          {
            email: 'alice@example.com',
            username: 'alice',
            password: 'password123',
          },
          {},
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('issues a session for correct credentials', async () => {
      const { service, prisma, password, tokens } = createDeps();
      prisma.user.findFirst.mockResolvedValue(fakeUser);
      password.verify.mockResolvedValue(true);
      tokens.issueAccessToken.mockResolvedValue(accessToken);
      tokens.issueRefreshToken.mockResolvedValue(issuedRefreshToken);

      const result = await service.login(
        { emailOrUsername: 'alice', password: 'password123' },
        {},
      );

      expect(result.user).toEqual(fakeUser);
    });

    it('rejects a wrong password', async () => {
      const { service, prisma, password } = createDeps();
      prisma.user.findFirst.mockResolvedValue(fakeUser);
      password.verify.mockResolvedValue(false);

      await expect(
        service.login({ emailOrUsername: 'alice', password: 'wrong' }, {}),
      ).rejects.toBeInstanceOf(InvalidCredentialsException);
    });

    it('rejects a nonexistent user with the same error as a wrong password, still calling verify()', async () => {
      const { service, prisma, password } = createDeps();
      prisma.user.findFirst.mockResolvedValue(null);
      password.verify.mockResolvedValue(false);

      await expect(
        service.login({ emailOrUsername: 'nobody', password: 'whatever' }, {}),
      ).rejects.toBeInstanceOf(InvalidCredentialsException);

      // Timing-safe: verify() must still run against a dummy hash so response
      // time doesn't reveal whether the account exists.
      expect(password.verify).toHaveBeenCalledTimes(1);
      expect(password.verify.mock.calls[0][0]).not.toBeUndefined();
    });
  });

  describe('refresh', () => {
    it('rotates the token and issues a fresh access token for that user', async () => {
      const { service, prisma, tokens } = createDeps();
      tokens.rotate.mockResolvedValue({
        userId: 'user-1',
        refreshToken: 'new-token',
        expiresAt: new Date(),
      });
      prisma.user.findUniqueOrThrow.mockResolvedValue(fakeUser);
      tokens.issueAccessToken.mockResolvedValue(accessToken);

      const result = await service.refresh('old-token', {});

      expect(tokens.rotate).toHaveBeenCalledWith('old-token', {});
      expect(result).toEqual({ ...accessToken, refreshToken: 'new-token' });
    });
  });

  describe('logout', () => {
    it('delegates to TokensService when a token is presented', async () => {
      const { service, tokens } = createDeps();
      await service.logout('some-token', { allDevices: true });
      expect(tokens.logout).toHaveBeenCalledWith('some-token', true);
    });

    it('is a no-op when no token is presented', async () => {
      const { service, tokens } = createDeps();
      await service.logout(undefined, { allDevices: false });
      expect(tokens.logout).not.toHaveBeenCalled();
    });
  });

  describe('getSessionUser', () => {
    it('returns the user when found and active', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findUnique.mockResolvedValue(fakeUser);

      await expect(service.getSessionUser('user-1')).resolves.toEqual(fakeUser);
    });

    it('rejects when the user no longer exists', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getSessionUser('user-1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a soft-deleted user', async () => {
      const { service, prisma } = createDeps();
      prisma.user.findUnique.mockResolvedValue({
        ...fakeUser,
        deletedAt: new Date(),
      });

      await expect(service.getSessionUser('user-1')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});

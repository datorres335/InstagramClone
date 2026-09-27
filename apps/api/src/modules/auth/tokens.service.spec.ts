import {
  InvalidRefreshTokenException,
  RefreshTokenReusedException,
} from './auth.exceptions';
import { createFakeApiEnv } from './test-utils/fake-api-env';
import { TokensService } from './tokens.service';

function createPrismaMock() {
  const refreshToken = {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };

  const prisma = {
    refreshToken,
    $transaction: jest.fn(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma),
    ),
  };

  return prisma;
}

function createService(prisma: ReturnType<typeof createPrismaMock>) {
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };
  const env = createFakeApiEnv();
  const service = new TokensService(prisma as never, jwt as never, env);
  return { service, jwt, env };
}

describe('TokensService', () => {
  describe('issueAccessToken', () => {
    it('signs a payload with sub and tokenVersion and computes an ISO expiry', async () => {
      const prisma = createPrismaMock();
      const { service, jwt } = createService(prisma);

      const result = await service.issueAccessToken({
        id: 'user-1',
        tokenVersion: 2,
      });

      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 'user-1',
        tokenVersion: 2,
      });
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(new Date(result.accessTokenExpiresAt).getTime()).toBeGreaterThan(
        Date.now(),
      );
    });
  });

  describe('issueRefreshToken', () => {
    it('creates a new row in a fresh family and returns an opaque token', async () => {
      const prisma = createPrismaMock();
      const { service } = createService(prisma);

      const result = await service.issueRefreshToken('user-1', {
        userAgent: 'jest',
        ipAddress: '127.0.0.1',
      });

      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      const data = prisma.refreshToken.create.mock.calls[0][0].data;
      expect(data.userId).toBe('user-1');
      expect(data.userAgent).toBe('jest');
      expect(data.ipAddress).toBe('127.0.0.1');
      expect(typeof data.familyId).toBe('string');
      expect(typeof data.tokenHash).toBe('string');
      expect(result.refreshToken).not.toBe(data.tokenHash); // raw token, not its hash
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('rotate', () => {
    it('rotates a valid token: revokes the old row, creates a new one in the same family', async () => {
      const prisma = createPrismaMock();
      const { service } = createService(prisma);
      const existing = {
        id: 'row-1',
        userId: 'user-1',
        familyId: 'family-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      };
      prisma.refreshToken.findUnique.mockResolvedValue(existing);

      const result = await service.rotate('presented-token', {});

      expect(result.userId).toBe('user-1');
      expect(typeof result.refreshToken).toBe('string');
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            familyId: 'family-1',
            userId: 'user-1',
          }),
        }),
      );
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'row-1' },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
          replacedByTokenHash: expect.any(String),
        }),
      });
      // The two must actually differ, or "rotation" isn't happening.
      const newTokenHash =
        prisma.refreshToken.create.mock.calls[0][0].data.tokenHash;
      const replacedByTokenHash =
        prisma.refreshToken.update.mock.calls[0][0].data.replacedByTokenHash;
      expect(replacedByTokenHash).toBe(newTokenHash);
    });

    it('throws InvalidRefreshTokenException for an unknown token, without revoking anything', async () => {
      const prisma = createPrismaMock();
      const { service } = createService(prisma);
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.rotate('unknown-token', {})).rejects.toBeInstanceOf(
        InvalidRefreshTokenException,
      );
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('throws InvalidRefreshTokenException for an expired token, without revoking the family', async () => {
      const prisma = createPrismaMock();
      const { service } = createService(prisma);
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'row-1',
        userId: 'user-1',
        familyId: 'family-1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000), // already expired
      });

      await expect(service.rotate('expired-token', {})).rejects.toBeInstanceOf(
        InvalidRefreshTokenException,
      );
      // Natural expiry is not suspicious — must not trigger family revocation.
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('detects reuse of an already-rotated-away token and revokes the whole family', async () => {
      const prisma = createPrismaMock();
      const { service } = createService(prisma);
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'row-1',
        userId: 'user-1',
        familyId: 'family-1',
        revokedAt: new Date(), // already used
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(service.rotate('reused-token', {})).rejects.toBeInstanceOf(
        RefreshTokenReusedException,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      // No new token should be minted for a reuse attempt.
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes only the token family by default', async () => {
      const prisma = createPrismaMock();
      const { service } = createService(prisma);
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'row-1',
        userId: 'user-1',
        familyId: 'family-1',
      });

      await service.logout('some-token', false);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'family-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('revokes every family for the user when allDevices is true', async () => {
      const prisma = createPrismaMock();
      const { service } = createService(prisma);
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'row-1',
        userId: 'user-1',
        familyId: 'family-1',
      });

      await service.logout('some-token', true);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('is a no-op for an unknown token (idempotent)', async () => {
      const prisma = createPrismaMock();
      const { service } = createService(prisma);
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        service.logout('unknown-token', false),
      ).resolves.toBeUndefined();
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });
  });
});

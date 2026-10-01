import { SearchService } from './search.service';

function fakeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    username: 'alice',
    fullName: 'Alice Anderson',
    avatarMedia: null,
    ...overrides,
  };
}

function createDeps() {
  const prisma = {
    $queryRaw: jest.fn(),
    user: { findMany: jest.fn() },
    follow: { findMany: jest.fn() },
  };
  const mediaService = {
    resolveAvatarUrl: jest.fn().mockReturnValue(null),
  };
  const service = new SearchService(prisma as never, mediaService as never);
  return { service, prisma, mediaService };
}

describe('SearchService', () => {
  describe('searchUsers', () => {
    it('returns an empty page without querying users/follows when nothing ranks', async () => {
      const { service, prisma } = createDeps();
      prisma.$queryRaw.mockResolvedValue([]);

      const result = await service.searchUsers(
        { q: 'zzqxnomatch', limit: 20 },
        undefined,
      );

      expect(result).toEqual({ data: [], meta: { nextCursor: null } });
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(prisma.follow.findMany).not.toHaveBeenCalled();
    });

    it('returns ranked results with resolved avatarUrl and null isFollowedByMe for an anonymous viewer', async () => {
      const { service, prisma, mediaService } = createDeps();
      prisma.$queryRaw.mockResolvedValue([{ id: 'user-1' }]);
      prisma.user.findMany.mockResolvedValue([fakeUser()]);
      mediaService.resolveAvatarUrl.mockReturnValue(
        'http://minio.test/avatar.webp',
      );

      const result = await service.searchUsers(
        { q: 'alice', limit: 20 },
        undefined,
      );

      expect(prisma.follow.findMany).not.toHaveBeenCalled();
      expect(result).toEqual({
        data: [
          {
            id: 'user-1',
            username: 'alice',
            fullName: 'Alice Anderson',
            avatarUrl: 'http://minio.test/avatar.webp',
            isFollowedByMe: null,
          },
        ],
        meta: { nextCursor: null },
      });
    });

    it('computes real isFollowedByMe per row for an authenticated viewer, with a single extra query', async () => {
      const { service, prisma } = createDeps();
      prisma.$queryRaw.mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]);
      prisma.user.findMany.mockResolvedValue([
        fakeUser({ id: 'user-1', username: 'alice' }),
        fakeUser({ id: 'user-2', username: 'alicia' }),
      ]);
      prisma.follow.findMany.mockResolvedValue([{ followingId: 'user-1' }]);

      const result = await service.searchUsers(
        { q: 'alic', limit: 20 },
        'viewer-1',
      );

      expect(prisma.follow.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.follow.findMany).toHaveBeenCalledWith({
        where: {
          followerId: 'viewer-1',
          followingId: { in: ['user-1', 'user-2'] },
        },
        select: { followingId: true },
      });
      expect(result.data[0].isFollowedByMe).toBe(true);
      expect(result.data[1].isFollowedByMe).toBe(false);
    });

    it('preserves the trigram-ranked order even though findMany({ where: { id: { in } } }) does not', async () => {
      const { service, prisma } = createDeps();
      prisma.$queryRaw.mockResolvedValue([{ id: 'user-2' }, { id: 'user-1' }]);
      // Deliberately returned in the "wrong" order to prove the service re-sorts.
      prisma.user.findMany.mockResolvedValue([
        fakeUser({ id: 'user-1', username: 'alice' }),
        fakeUser({ id: 'user-2', username: 'alicia' }),
      ]);

      const result = await service.searchUsers(
        { q: 'ali', limit: 20 },
        undefined,
      );

      expect(result.data.map((item) => item.id)).toEqual(['user-2', 'user-1']);
    });

    it('always returns a null nextCursor, regardless of result count', async () => {
      const { service, prisma } = createDeps();
      prisma.$queryRaw.mockResolvedValue([{ id: 'user-1' }]);
      prisma.user.findMany.mockResolvedValue([fakeUser()]);

      const result = await service.searchUsers(
        { q: 'alice', limit: 1 },
        undefined,
      );

      expect(result.meta.nextCursor).toBeNull();
    });
  });
});

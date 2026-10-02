import { BadRequestException } from '@nestjs/common';

import { encodeExploreCursor } from '../../common/pagination/explore-cursor';
import { ExploreService } from './explore.service';

function createDeps() {
  const prisma = {
    $queryRaw: jest.fn(),
  };
  const service = new ExploreService(prisma as never);
  return { service, prisma };
}

function fakeRow(
  id: string,
  likesCount: number,
  createdAt = new Date('2026-01-02T00:00:00.000Z'),
) {
  return { id, created_at: createdAt, likes_count: BigInt(likesCount) };
}

describe('ExploreService', () => {
  describe('getRankedPostIds', () => {
    it('returns a page of ranked postIds with no nextCursor when the page is not full', async () => {
      const { service, prisma } = createDeps();
      prisma.$queryRaw.mockResolvedValue([fakeRow('post-1', 5)]);

      const result = await service.getRankedPostIds('viewer-1', {
        limit: 20,
      });

      expect(result.postIds).toEqual(['post-1']);
      expect(result.nextCursor).toBeNull();
    });

    it('returns a nextCursor when there are more rows than the page limit', async () => {
      const { service, prisma } = createDeps();
      prisma.$queryRaw.mockResolvedValue([
        fakeRow('post-1', 9),
        fakeRow('post-2', 5),
        fakeRow('post-3', 1),
      ]);

      const result = await service.getRankedPostIds('viewer-1', { limit: 2 });

      expect(result.postIds).toEqual(['post-1', 'post-2']);
      expect(result.nextCursor).not.toBeNull();
    });

    it('rejects a malformed cursor with BadRequestException', async () => {
      const { service } = createDeps();

      await expect(
        service.getRankedPostIds('viewer-1', {
          cursor: 'not-a-real-cursor!!',
          limit: 20,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a well-formed explore cursor without throwing', async () => {
      const { service, prisma } = createDeps();
      prisma.$queryRaw.mockResolvedValue([]);
      const cursor = encodeExploreCursor({
        likesCount: 5,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        id: 'post-9',
      });

      const result = await service.getRankedPostIds('viewer-1', {
        cursor,
        limit: 20,
      });

      expect(result).toEqual({ postIds: [], nextCursor: null });
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('passes the viewerId to the raw query for both the self-exclusion and not-following filters', async () => {
      const { service, prisma } = createDeps();
      prisma.$queryRaw.mockResolvedValue([]);

      await service.getRankedPostIds('viewer-42', { limit: 20 });

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      const [, ...values] = prisma.$queryRaw.mock.calls[0];
      // The tagged-template call embeds viewerId twice (self-exclusion,
      // not-following subquery) plus the window start and limit — just
      // confirm viewerId actually appears among the bound values rather
      // than asserting the full SQL text, which would be brittle.
      expect(values).toContain('viewer-42');
    });
  });
});

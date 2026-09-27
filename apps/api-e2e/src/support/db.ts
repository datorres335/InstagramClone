import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@instagram-clone/prisma-client';

/**
 * A direct DB connection for e2e tests that need to reach into state the
 * HTTP API has no route for (e.g. forcing a refresh token to look expired
 * without waiting 30 real days). Tests should prefer driving everything
 * through HTTP; reach for this only when there's no other way.
 */
export function createTestPrismaClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

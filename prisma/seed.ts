import 'dotenv/config';

import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client';

/**
 * Prisma seed script (run via `prisma db seed`, configured in
 * prisma.config.ts). Seeds a small, deterministic set of users for local
 * development and for API integration tests to run against.
 *
 * Only `User` exists so far (see docs/DATABASE.md §9) — this grows
 * incrementally as each milestone's models land (follow relationships,
 * posts, likes, comments, notifications), rather than seeding data for
 * tables that don't exist yet.
 */

const DEV_PASSWORD = 'Password123!';

const seedUsers = [
  {
    username: 'alice',
    email: 'alice@example.com',
    fullName: 'Alice Anderson',
    bio: 'Just here for the photos.',
  },
  {
    username: 'bob',
    email: 'bob@example.com',
    fullName: 'Bob Baker',
    bio: 'Private account.',
    isPrivate: true,
  },
  {
    username: 'carol',
    email: 'carol@example.com',
    fullName: 'Carol Chen',
    bio: null,
  },
] as const;

async function main() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const passwordHash = await argon2.hash(DEV_PASSWORD);

    for (const user of seedUsers) {
      await prisma.user.upsert({
        where: { email: user.email },
        create: { ...user, passwordHash },
        update: { ...user, passwordHash },
      });
    }

    console.warn(
      `Seeded ${seedUsers.length} users (dev password for all: "${DEV_PASSWORD}").`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

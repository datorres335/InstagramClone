import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 config — see docs/ARCHITECTURE.md §12 (risk #1) and
// https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference.
// The datasource URL lives here (not in schema.prisma) as of Prisma 7.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});

/**
 * Produces a static `openapi.json` next to this file's project root, for
 * `packages/api-client`'s `openapi-typescript` codegen step (docs/
 * ARCHITECTURE.md §6.2, risk #2) — run via `nx run api:generate-openapi`.
 * Gitignored, like `prisma/generated/`: a build artifact regenerated on
 * demand, not a file to keep in sync by hand.
 *
 * `abortOnError: false` is deliberate and load-bearing, not a shortcut:
 * `SwaggerModule.createDocument` only reads controller/DTO *metadata*
 * assembled during module compilation — it runs before any lifecycle hook,
 * so it doesn't need `PrismaService.onModuleInit()`'s live `$connect()` to
 * have succeeded. Without this flag, `NestFactory.create` would reject the
 * whole call if Postgres happened to be unreachable, making a purely static
 * analysis step fail for a reason that has nothing to do with what it's
 * actually computing. `main.ts` intentionally does NOT use this flag — a
 * real server should still fail fast on bad DB connectivity.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';
import { configureApp } from './app/configure-app';
import { buildOpenApiDocument } from './openapi-document';

async function main() {
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  configureApp(app);

  const document = buildOpenApiDocument(app);
  const outPath = join(__dirname, '../openapi.json');
  writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`);
  // eslint-disable-next-line no-console -- this is a CLI script, not the server
  console.log(`Wrote ${outPath}`);

  await app.close();
  process.exit(0);
}

main();

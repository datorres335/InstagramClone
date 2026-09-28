/**
 * This is not a production server yet!
 * This is only a minimal backend to get started — see docs/IMPLEMENTATION_PLAN.md
 * for the milestones that add real modules (auth, posts, etc.) on top of this.
 */

import 'dotenv/config';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { apiEnvSchema, loadEnv } from '@instagram-clone/config';

import { AppModule } from './app/app.module';
import { configureApp } from './app/configure-app';
import { buildOpenApiDocument } from './openapi-document';

async function bootstrap() {
  // Fail fast on a misconfigured environment rather than starting the
  // process with silently-wrong config. See docs/ARCHITECTURE.md §6
  // (packages/config) and .env.example for what each variable does.
  const env = loadEnv(apiEnvSchema);

  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  // Needed to read the refresh-token cookie (docs/ARCHITECTURE.md §7) off
  // incoming requests — setting a cookie needs no extra middleware, but
  // reading `req.cookies` does.
  app.use(cookieParser());
  app.enableCors({
    origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : true,
    credentials: true,
  });

  // Every route is versioned from the start (see docs/API.md §1) so a future
  // v2 is additive rather than a breaking refactor of existing routes.
  configureApp(app);

  // OpenAPI, generated from the same Zod-derived DTOs the global
  // ZodValidationPipe validates against (docs/ARCHITECTURE.md §5.2). The
  // interactive UI is dev/test-only; the raw JSON is also served at
  // `/api/docs-json` by SwaggerModule's own default. `packages/api-client`'s
  // codegen (Milestone 6) reads a static `apps/api/openapi.json` instead,
  // produced by `nx run api:generate-openapi` (see `generate-openapi.ts`),
  // which builds this exact same document without booting an HTTP listener.
  const openApiDocument = buildOpenApiDocument(app);
  if (env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api/docs', app, openApiDocument);
  }

  await app.listen(env.PORT, env.HOST);
  Logger.log(
    `🚀 Application is running on: http://${env.HOST}:${env.PORT}/api/v1`,
  );
}

bootstrap();

/**
 * This is not a production server yet!
 * This is only a minimal backend to get started — see docs/IMPLEMENTATION_PLAN.md
 * for the milestones that add real modules (auth, posts, etc.) on top of this.
 */

import 'dotenv/config';

import { Logger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { apiEnvSchema, loadEnv } from '@instagram-clone/config';

import { AppModule } from './app/app.module';

async function bootstrap() {
  // Fail fast on a misconfigured environment rather than starting the
  // process with silently-wrong config. See docs/ARCHITECTURE.md §6
  // (packages/config) and .env.example for what each variable does.
  const env = loadEnv(apiEnvSchema);

  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors({
    origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : true,
    credentials: true,
  });

  // Every route is versioned from the start (see docs/API.md §1) so a future
  // v2 is additive rather than a breaking refactor of existing routes.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');

  // OpenAPI, generated from the same Zod-derived DTOs the global
  // ZodValidationPipe validates against (docs/ARCHITECTURE.md §5.2).
  // `cleanupOpenApiDoc` is required by nestjs-zod to get correct output —
  // without it, Zod-derived schemas render incorrectly in the document.
  // The interactive UI is dev/test-only; the raw JSON (served at
  // `/api/docs-json` by SwaggerModule's own default) is what Milestone 6's
  // `packages/api-client` codegen will consume — see docs/ARCHITECTURE.md
  // risk #2. A dedicated `nx run api:openapi`-style target that writes this
  // to a file as a true build artifact (rather than an HTTP endpoint) is
  // deferred to that milestone, once its actual consumption contract exists.
  const openApiDocument = cleanupOpenApiDoc(
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Instagram Clone API')
        .setDescription('See docs/API.md for the full, authoritative contract.')
        .setVersion('1')
        .addBearerAuth()
        .build(),
    ),
  );
  if (env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api/docs', app, openApiDocument);
  }

  await app.listen(env.PORT, env.HOST);
  Logger.log(
    `🚀 Application is running on: http://${env.HOST}:${env.PORT}/api/v1`,
  );
}

bootstrap();

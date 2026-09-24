/**
 * This is not a production server yet!
 * This is only a minimal backend to get started — see docs/IMPLEMENTATION_PLAN.md
 * for the milestones that add real modules (auth, posts, etc.) on top of this.
 */

import 'dotenv/config';

import { Logger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

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

  await app.listen(env.PORT, env.HOST);
  Logger.log(
    `🚀 Application is running on: http://${env.HOST}:${env.PORT}/api/v1`,
  );
}

bootstrap();

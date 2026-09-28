import { type INestApplication, VersioningType } from '@nestjs/common';

/**
 * Global prefix/versioning, applied identically by `main.ts` (the real
 * server) and `generate-openapi.ts` (the static-doc generator) — the two
 * must never drift, or the generated spec's route paths (`/api/v1/...`)
 * would stop matching what the server actually serves.
 */
export function configureApp(app: INestApplication): void {
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix('api');
}

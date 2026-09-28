import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

/**
 * Single source of truth for the OpenAPI document's own metadata (title,
 * description, auth scheme). Shared by `main.ts` (serves it live at
 * `/api/docs-json`) and `generate-openapi.ts` (writes it to disk for
 * `packages/api-client`'s codegen — docs/ARCHITECTURE.md §6.2) so the two
 * can never describe the API differently.
 */
export function buildOpenApiDocument(app: INestApplication) {
  return cleanupOpenApiDoc(
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
}

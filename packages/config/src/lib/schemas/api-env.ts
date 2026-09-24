import { z } from 'zod';

/**
 * Environment schema for apps/api. Mirrors the variables documented in
 * `.env.example` (root of the repo) — keep the two in sync.
 */
export const apiEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  // Named PORT/HOST (not API_PORT/API_HOST) to match the convention Nx's own
  // generated e2e harness (apps/api-e2e/src/support/global-setup.ts) and most
  // hosting platforms already use — see docs/ARCHITECTURE.md §6.
  HOST: z.string().min(1).default('localhost'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  JWT_ACCESS_TOKEN_SECRET: z
    .string()
    .min(16, 'JWT_ACCESS_TOKEN_SECRET must be at least 16 characters'),
  JWT_ACCESS_TOKEN_TTL: z.string().min(1).default('15m'),
  REFRESH_TOKEN_TTL: z.string().min(1).default('30d'),

  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  S3_ENDPOINT: z.string().min(1, 'S3_ENDPOINT is required'),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().min(1, 'S3_ACCESS_KEY_ID is required'),
  S3_SECRET_ACCESS_KEY: z.string().min(1, 'S3_SECRET_ACCESS_KEY is required'),
  S3_BUCKET: z.string().min(1, 'S3_BUCKET is required'),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

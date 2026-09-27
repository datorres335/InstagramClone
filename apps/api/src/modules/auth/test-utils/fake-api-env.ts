import type { ApiEnv } from '@instagram-clone/config';

/** A fully-populated `ApiEnv` for unit tests that only care about a few fields. */
export function createFakeApiEnv(overrides: Partial<ApiEnv> = {}): ApiEnv {
  return {
    NODE_ENV: 'test',
    HOST: 'localhost',
    PORT: 3000,
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_TOKEN_SECRET: 'test-secret-at-least-16-chars',
    JWT_ACCESS_TOKEN_TTL: '15m',
    REFRESH_TOKEN_TTL: '30d',
    CORS_ORIGINS: [],
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'us-east-1',
    S3_ACCESS_KEY_ID: 'test',
    S3_SECRET_ACCESS_KEY: 'test',
    S3_BUCKET: 'test-bucket',
    S3_FORCE_PATH_STYLE: true,
    ...overrides,
  };
}

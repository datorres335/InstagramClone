import { apiEnvSchema } from './api-env';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_TOKEN_SECRET: 'a-secret-that-is-long-enough',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
  S3_BUCKET: 'bucket',
};

describe('apiEnvSchema', () => {
  it('accepts a valid environment and applies defaults', () => {
    const result = apiEnvSchema.parse(validEnv);

    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3000);
    expect(result.S3_FORCE_PATH_STYLE).toBe(false);
  });

  it('splits CORS_ORIGINS into an array', () => {
    const result = apiEnvSchema.parse({
      ...validEnv,
      CORS_ORIGINS: 'http://localhost:3000, http://localhost:3001',
    });

    expect(result.CORS_ORIGINS).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
    ]);
  });

  it('rejects a JWT secret that is too short', () => {
    const result = apiEnvSchema.safeParse({
      ...validEnv,
      JWT_ACCESS_TOKEN_SECRET: 'short',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL: _DATABASE_URL, ...rest } = validEnv;
    const result = apiEnvSchema.safeParse(rest);

    expect(result.success).toBe(false);
  });
});

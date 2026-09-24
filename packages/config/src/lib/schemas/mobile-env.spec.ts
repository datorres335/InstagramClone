import { mobileEnvSchema } from './mobile-env';

describe('mobileEnvSchema', () => {
  it('accepts a valid API URL', () => {
    const result = mobileEnvSchema.safeParse({
      EXPO_PUBLIC_API_URL: 'http://localhost:3333/api/v1',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a non-URL value', () => {
    const result = mobileEnvSchema.safeParse({
      EXPO_PUBLIC_API_URL: 'not-a-url',
    });

    expect(result.success).toBe(false);
  });
});

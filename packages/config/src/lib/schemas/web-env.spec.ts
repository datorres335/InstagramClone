import { webEnvSchema } from './web-env';

describe('webEnvSchema', () => {
  it('accepts a valid API URL', () => {
    const result = webEnvSchema.safeParse({
      NEXT_PUBLIC_API_URL: 'http://localhost:3333/api/v1',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a non-URL value', () => {
    const result = webEnvSchema.safeParse({ NEXT_PUBLIC_API_URL: 'not-a-url' });

    expect(result.success).toBe(false);
  });
});

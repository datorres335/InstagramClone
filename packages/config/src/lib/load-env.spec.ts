import { z } from 'zod';

import { EnvValidationError, loadEnv } from './load-env';

const testSchema = z.object({
  REQUIRED_VALUE: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
});

describe('loadEnv', () => {
  it('parses and coerces a valid environment', () => {
    const env = loadEnv(testSchema, { REQUIRED_VALUE: 'hello', PORT: '4000' });

    expect(env).toEqual({ REQUIRED_VALUE: 'hello', PORT: 4000 });
  });

  it('applies schema defaults for missing optional variables', () => {
    const env = loadEnv(testSchema, { REQUIRED_VALUE: 'hello' });

    expect(env.PORT).toBe(3000);
  });

  it('throws EnvValidationError with every violation when validation fails', () => {
    expect.assertions(2);

    try {
      loadEnv(testSchema, { PORT: 'not-a-number' });
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as Error).message).toContain('REQUIRED_VALUE');
    }
  });
});

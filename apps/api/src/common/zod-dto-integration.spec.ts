import { createZodDto, ZodValidationPipe } from 'nestjs-zod';

import { loginInputSchema } from '@instagram-clone/validation';

/**
 * Proves the actual pattern Milestone 5's real controllers will use —
 * wrapping a `packages/validation` schema in `createZodDto` and validating
 * it through `nestjs-zod`'s pipe — works end-to-end, using a real schema
 * from Milestone 3 rather than an ad-hoc one. No controller exists yet to
 * exercise this over real HTTP; that lands with Milestone 5's endpoints.
 */
class LoginDto extends createZodDto(loginInputSchema) {}

describe('createZodDto + ZodValidationPipe (real packages/validation schema)', () => {
  const pipe = new ZodValidationPipe();

  it('passes through a valid body, typed as the DTO', async () => {
    const result = await pipe.transform(
      { emailOrUsername: 'alice', password: 'password123' },
      { type: 'body', metatype: LoginDto },
    );

    expect(result).toEqual({
      emailOrUsername: 'alice',
      password: 'password123',
    });
  });

  it('rejects an invalid body', () => {
    // nestjs-zod's pipe throws synchronously (not a rejected promise) on
    // validation failure, so this asserts against the call itself.
    expect(() =>
      pipe.transform(
        { emailOrUsername: '', password: '' },
        { type: 'body', metatype: LoginDto },
      ),
    ).toThrow();
  });
});

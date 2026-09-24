import {
  authResponseSchema,
  loginInputSchema,
  logoutInputSchema,
  passwordSchema,
  refreshInputSchema,
  refreshResponseSchema,
  registerInputSchema,
  sessionResponseSchema,
} from './auth';

const validUser = {
  id: '018f3b3e-2c3a-7c3a-8b3a-000000000000',
  username: 'alice',
  email: 'alice@example.com',
  fullName: 'Alice Anderson',
  bio: null,
  websiteUrl: null,
  isPrivate: false,
  createdAt: '2026-09-24T00:00:00.000Z',
};

describe('passwordSchema', () => {
  it('accepts an 8-character password', () => {
    expect(passwordSchema.safeParse('password').success).toBe(true);
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(passwordSchema.safeParse('short1').success).toBe(false);
  });

  it('rejects a password longer than 128 characters', () => {
    expect(passwordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });

  it('has no mandated character classes — a plain lowercase word is valid', () => {
    expect(passwordSchema.safeParse('lowercaseonly').success).toBe(true);
  });
});

describe('registerInputSchema', () => {
  const validInput = {
    email: 'alice@example.com',
    username: 'alice',
    password: 'password123',
  };

  it('accepts a valid registration without fullName', () => {
    expect(registerInputSchema.safeParse(validInput).success).toBe(true);
  });

  it('accepts an optional fullName', () => {
    const result = registerInputSchema.safeParse({
      ...validInput,
      fullName: 'Alice Anderson',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = registerInputSchema.safeParse({
      ...validInput,
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid username', () => {
    const result = registerInputSchema.safeParse({
      ...validInput,
      username: 'a',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a weak password', () => {
    const result = registerInputSchema.safeParse({
      ...validInput,
      password: 'short',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginInputSchema', () => {
  it('accepts a valid login by email', () => {
    const result = loginInputSchema.safeParse({
      emailOrUsername: 'alice@example.com',
      password: 'anything',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid login by username', () => {
    const result = loginInputSchema.safeParse({
      emailOrUsername: 'alice',
      password: 'anything',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty emailOrUsername', () => {
    const result = loginInputSchema.safeParse({
      emailOrUsername: '',
      password: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty password', () => {
    const result = loginInputSchema.safeParse({
      emailOrUsername: 'alice',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('refreshInputSchema', () => {
  it('accepts an empty body (web — token comes from the cookie)', () => {
    expect(refreshInputSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a body with refreshToken (mobile)', () => {
    const result = refreshInputSchema.safeParse({
      refreshToken: 'opaque-token',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty-string refreshToken', () => {
    const result = refreshInputSchema.safeParse({ refreshToken: '' });
    expect(result.success).toBe(false);
  });
});

describe('logoutInputSchema', () => {
  it('accepts an empty body', () => {
    expect(logoutInputSchema.safeParse({}).success).toBe(true);
  });

  it('accepts allDevices and refreshToken together', () => {
    const result = logoutInputSchema.safeParse({
      allDevices: true,
      refreshToken: 'opaque-token',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-boolean allDevices', () => {
    const result = logoutInputSchema.safeParse({ allDevices: 'yes' });
    expect(result.success).toBe(false);
  });
});

describe('authResponseSchema', () => {
  it('accepts a web response (no refreshToken)', () => {
    const result = authResponseSchema.safeParse({
      user: validUser,
      accessToken: 'jwt',
      accessTokenExpiresAt: '2026-09-24T00:15:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a mobile response (with refreshToken)', () => {
    const result = authResponseSchema.safeParse({
      user: validUser,
      accessToken: 'jwt',
      accessTokenExpiresAt: '2026-09-24T00:15:00.000Z',
      refreshToken: 'opaque-token',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-ISO accessTokenExpiresAt', () => {
    const result = authResponseSchema.safeParse({
      user: validUser,
      accessToken: 'jwt',
      accessTokenExpiresAt: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });
});

describe('refreshResponseSchema', () => {
  it('accepts a valid refresh response', () => {
    const result = refreshResponseSchema.safeParse({
      accessToken: 'jwt',
      accessTokenExpiresAt: '2026-09-24T00:15:00.000Z',
    });
    expect(result.success).toBe(true);
  });
});

describe('sessionResponseSchema', () => {
  it('accepts a valid session response', () => {
    expect(sessionResponseSchema.safeParse({ user: validUser }).success).toBe(
      true,
    );
  });

  it('rejects a missing user', () => {
    expect(sessionResponseSchema.safeParse({}).success).toBe(false);
  });
});

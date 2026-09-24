import { usernameSchema, userResponseSchema } from './user';

describe('usernameSchema', () => {
  it('accepts a valid username', () => {
    expect(usernameSchema.safeParse('alice_92.b').success).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    const result = usernameSchema.parse('  alice  ');
    expect(result).toBe('alice');
  });

  it('rejects a username shorter than 3 characters', () => {
    expect(usernameSchema.safeParse('ab').success).toBe(false);
  });

  it('rejects a username longer than 30 characters', () => {
    expect(usernameSchema.safeParse('a'.repeat(31)).success).toBe(false);
  });

  it('rejects characters outside letters, numbers, underscore, and period', () => {
    expect(usernameSchema.safeParse('alice smith').success).toBe(false);
    expect(usernameSchema.safeParse('alice@smith').success).toBe(false);
    expect(usernameSchema.safeParse('alice-smith').success).toBe(false);
  });
});

describe('userResponseSchema', () => {
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

  it('accepts a valid user object', () => {
    expect(userResponseSchema.safeParse(validUser).success).toBe(true);
  });

  it('accepts non-null bio and websiteUrl', () => {
    const result = userResponseSchema.safeParse({
      ...validUser,
      bio: 'Just here for the photos.',
      websiteUrl: 'https://example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = userResponseSchema.safeParse({
      ...validUser,
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-UUID id', () => {
    const result = userResponseSchema.safeParse({
      ...validUser,
      id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a bio longer than 150 characters', () => {
    const result = userResponseSchema.safeParse({
      ...validUser,
      bio: 'a'.repeat(151),
    });
    expect(result.success).toBe(false);
  });

  it('never exposes passwordHash even if present on the input object', () => {
    const parsed = userResponseSchema.parse({
      ...validUser,
      passwordHash: 'should-be-stripped',
    });
    expect(parsed).not.toHaveProperty('passwordHash');
  });
});

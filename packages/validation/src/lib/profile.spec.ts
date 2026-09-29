import {
  publicProfileResponseSchema,
  updateProfileInputSchema,
  userPostsResponseSchema,
} from './profile';

const validProfile = {
  id: '018f3b3e-2c3a-7c3a-8b3a-000000000000',
  username: 'alice',
  fullName: 'Alice Anderson',
  bio: null,
  websiteUrl: null,
  avatarUrl: null,
  isPrivate: false,
  postsCount: 0,
  followersCount: 0,
  followingCount: 0,
  isFollowedByMe: null,
  createdAt: '2026-09-24T00:00:00.000Z',
};

describe('publicProfileResponseSchema', () => {
  it('accepts a valid public profile with everything stubbed', () => {
    expect(publicProfileResponseSchema.safeParse(validProfile).success).toBe(
      true,
    );
  });

  it('accepts isFollowedByMe as a real boolean for an authenticated viewer', () => {
    const result = publicProfileResponseSchema.safeParse({
      ...validProfile,
      isFollowedByMe: true,
    });
    expect(result.success).toBe(true);
  });

  it('strips an email field if present — the public shape never carries it', () => {
    const result = publicProfileResponseSchema.safeParse({
      ...validProfile,
      email: 'alice@example.com',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('email');
    }
  });

  it('rejects a negative postsCount', () => {
    expect(
      publicProfileResponseSchema.safeParse({ ...validProfile, postsCount: -1 })
        .success,
    ).toBe(false);
  });

  it('rejects a bio over 150 characters', () => {
    const result = publicProfileResponseSchema.safeParse({
      ...validProfile,
      bio: 'a'.repeat(151),
    });
    expect(result.success).toBe(false);
  });
});

describe('updateProfileInputSchema', () => {
  it('accepts an empty object — every field is optional', () => {
    expect(updateProfileInputSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a partial update of just one field', () => {
    expect(
      updateProfileInputSchema.safeParse({ bio: 'Hello world' }).success,
    ).toBe(true);
  });

  it('accepts an explicit null to clear a nullable field', () => {
    const result = updateProfileInputSchema.safeParse({
      bio: null,
      websiteUrl: null,
      fullName: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a blank fullName', () => {
    expect(
      updateProfileInputSchema.safeParse({ fullName: '   ' }).success,
    ).toBe(false);
  });

  it('rejects a bio over 150 characters', () => {
    expect(
      updateProfileInputSchema.safeParse({ bio: 'a'.repeat(151) }).success,
    ).toBe(false);
  });

  it('rejects a non-URL websiteUrl', () => {
    expect(
      updateProfileInputSchema.safeParse({ websiteUrl: 'not-a-url' }).success,
    ).toBe(false);
  });

  it('accepts isPrivate as a plain boolean', () => {
    expect(
      updateProfileInputSchema.safeParse({ isPrivate: true }).success,
    ).toBe(true);
  });
});

describe('userPostsResponseSchema', () => {
  it('accepts an empty page', () => {
    const result = userPostsResponseSchema.safeParse({
      data: [],
      meta: { nextCursor: null },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-empty data array — there is no post shape to validate against yet', () => {
    const result = userPostsResponseSchema.safeParse({
      data: [{ id: '1' }],
      meta: { nextCursor: null },
    });
    expect(result.success).toBe(false);
  });
});

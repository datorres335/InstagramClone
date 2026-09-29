import axios from 'axios';

import { randomRegisterInput } from '../support/random-user';

async function registerUser() {
  const credentials = randomRegisterInput();
  const res = await axios.post('/api/v1/auth/register', credentials);
  return {
    credentials,
    accessToken: res.data.accessToken as string,
    user: res.data.user,
  };
}

// Registers a handful of users once for the whole file rather than per test
// — `POST /auth/register` is throttled to 10/min/IP (docs/API.md §1), and
// this file runs alongside the other auth e2e suites against the same
// server, so registration calls are a shared, limited budget across the
// entire api-e2e run, not just within this file.
let owner: Awaited<ReturnType<typeof registerUser>>;
let viewer: Awaited<ReturnType<typeof registerUser>>;
let otherUser: Awaited<ReturnType<typeof registerUser>>;

beforeAll(async () => {
  [owner, viewer, otherUser] = await Promise.all([
    registerUser(),
    registerUser(),
    registerUser(),
  ]);
});

describe('users: profile read', () => {
  // Runs before the "profile update" describe below mutates `owner` — order
  // matters here, since these assertions rely on `owner`'s untouched state.

  it('returns the public profile shape for an unauthenticated viewer, isFollowedByMe null', async () => {
    const res = await axios.get(`/api/v1/users/${owner.credentials.username}`);

    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({
      username: owner.credentials.username,
      isPrivate: false,
      avatarUrl: null,
      postsCount: 0,
      followersCount: 0,
      followingCount: 0,
      isFollowedByMe: null,
    });
    expect(res.data).not.toHaveProperty('email');
  });

  it('computes isFollowedByMe as false (not null) for an authenticated viewer', async () => {
    const res = await axios.get(`/api/v1/users/${owner.credentials.username}`, {
      headers: { Authorization: `Bearer ${viewer.accessToken}` },
    });

    expect(res.data.isFollowedByMe).toBe(false);
  });

  it('returns 404 Problem Details for a username that does not exist', async () => {
    let error: unknown;
    try {
      await axios.get('/api/v1/users/no-such-user-e2e');
    } catch (caught) {
      error = caught;
    }

    expect(axios.isAxiosError(error)).toBe(true);
    if (!axios.isAxiosError(error) || !error.response) {
      throw new Error('Expected an axios error response');
    }
    expect(error.response.status).toBe(404);
    expect(error.response.data.type).toBe(
      'https://api.instagram-clone.dev/errors/not-found',
    );
  });

  it('returns an always-empty paginated envelope for /posts', async () => {
    const res = await axios.get(
      `/api/v1/users/${owner.credentials.username}/posts?limit=5`,
    );

    expect(res.status).toBe(200);
    expect(res.data).toEqual({ data: [], meta: { nextCursor: null } });
  });

  it('404s /posts for a username that does not exist too', async () => {
    await expect(
      axios.get('/api/v1/users/no-such-user-e2e/posts'),
    ).rejects.toMatchObject({
      response: { status: 404 },
    });
  });
});

describe('users: profile update (PATCH /me)', () => {
  it("updates the caller's own profile and persists the change", async () => {
    const patchRes = await axios.patch(
      '/api/v1/me',
      {
        bio: 'Hello from e2e',
        websiteUrl: 'https://example.com',
        isPrivate: true,
      },
      { headers: { Authorization: `Bearer ${owner.accessToken}` } },
    );
    expect(patchRes.status).toBe(200);
    expect(patchRes.data).toMatchObject({
      bio: 'Hello from e2e',
      websiteUrl: 'https://example.com',
      isPrivate: true,
      email: owner.credentials.email,
    });

    const profileRes = await axios.get(
      `/api/v1/users/${owner.credentials.username}`,
    );
    expect(profileRes.data).toMatchObject({
      bio: 'Hello from e2e',
      websiteUrl: 'https://example.com',
      isPrivate: true,
    });
  });

  it('clears a field with an explicit null', async () => {
    const patchRes = await axios.patch(
      '/api/v1/me',
      { bio: null },
      { headers: { Authorization: `Bearer ${owner.accessToken}` } },
    );

    // Prior test in this file already set bio to a non-null value — this
    // proves null actually clears it rather than being ignored as "no change".
    expect(patchRes.data.bio).toBeNull();
  });

  it('rejects an unauthenticated update with 401', async () => {
    await expect(
      axios.patch('/api/v1/me', { bio: 'hack' }),
    ).rejects.toMatchObject({
      response: { status: 401 },
    });
  });

  it('rejects an invalid websiteUrl with a 400 field-level error', async () => {
    let error: unknown;
    try {
      await axios.patch(
        '/api/v1/me',
        { websiteUrl: 'not-a-url' },
        { headers: { Authorization: `Bearer ${owner.accessToken}` } },
      );
    } catch (caught) {
      error = caught;
    }

    expect(axios.isAxiosError(error)).toBe(true);
    if (!axios.isAxiosError(error) || !error.response) {
      throw new Error('Expected an axios error response');
    }
    expect(error.response.status).toBe(400);
    expect(error.response.data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'websiteUrl' })]),
    );
  });

  it("never touches another user's account, even though PATCH /me takes no target id", async () => {
    // docs/IMPLEMENTATION_PLAN.md's M8 test scope asks for "a private-field
    // update from a non-owner is rejected (403)" — PATCH /me has no
    // :username/target param for a non-owner to even attempt targeting
    // someone else with, so the equivalent, meaningful property to verify
    // is this one: one user's update can never affect another's row.
    await axios.patch(
      '/api/v1/me',
      { fullName: 'Owner Edited This' },
      { headers: { Authorization: `Bearer ${owner.accessToken}` } },
    );

    const otherUserProfile = await axios.get(
      `/api/v1/users/${otherUser.credentials.username}`,
    );
    expect(otherUserProfile.data).toMatchObject({
      fullName: null,
      bio: null,
      isPrivate: false,
    });
  });
});

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

function authHeader(accessToken: string) {
  return { headers: { Authorization: `Bearer ${accessToken}` } };
}

// Registered once for the whole file, not per test — `POST /auth/register`
// is a shared, limited budget across the entire api-e2e run (see
// `apps/api-e2e/src/users/profile.spec.ts`'s identical note). `owner` is
// followed by all three of `followerA`/`followerB`/`followerC` so the
// followers-list tests have enough real rows to exercise cursor pagination.
let owner: Awaited<ReturnType<typeof registerUser>>;
let followerA: Awaited<ReturnType<typeof registerUser>>;
let followerB: Awaited<ReturnType<typeof registerUser>>;
let followerC: Awaited<ReturnType<typeof registerUser>>;

beforeAll(async () => {
  [owner, followerA, followerB, followerC] = await Promise.all([
    registerUser(),
    registerUser(),
    registerUser(),
    registerUser(),
  ]);
});

describe('follows: PUT/DELETE /users/:username/follow', () => {
  it('follows a user, is idempotent on a repeat call, and 404s for a nonexistent target', async () => {
    const followRes = await axios.put(
      `/api/v1/users/${owner.credentials.username}/follow`,
      undefined,
      authHeader(followerA.accessToken),
    );
    expect(followRes.status).toBe(204);

    const repeatRes = await axios.put(
      `/api/v1/users/${owner.credentials.username}/follow`,
      undefined,
      authHeader(followerA.accessToken),
    );
    expect(repeatRes.status).toBe(204);

    await expect(
      axios.put(
        '/api/v1/users/no-such-user-e2e/follow',
        undefined,
        authHeader(followerA.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('rejects self-follow with 409', async () => {
    await expect(
      axios.put(
        `/api/v1/users/${owner.credentials.username}/follow`,
        undefined,
        authHeader(owner.accessToken),
      ),
    ).rejects.toMatchObject({
      response: {
        status: 409,
        data: { type: 'https://api.instagram-clone.dev/errors/conflict' },
      },
    });
  });

  it('rejects an unauthenticated follow with 401', async () => {
    await expect(
      axios.put(`/api/v1/users/${owner.credentials.username}/follow`),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('unfollows a user, idempotent whether or not the edge existed', async () => {
    await axios.put(
      `/api/v1/users/${owner.credentials.username}/follow`,
      undefined,
      authHeader(followerB.accessToken),
    );

    const unfollowRes = await axios.delete(
      `/api/v1/users/${owner.credentials.username}/follow`,
      authHeader(followerB.accessToken),
    );
    expect(unfollowRes.status).toBe(204);

    // Already unfollowed — deleting again is still a clean 204, not a 404.
    const repeatRes = await axios.delete(
      `/api/v1/users/${owner.credentials.username}/follow`,
      authHeader(followerB.accessToken),
    );
    expect(repeatRes.status).toBe(204);

    const profileRes = await axios.get(
      `/api/v1/users/${owner.credentials.username}`,
      authHeader(followerB.accessToken),
    );
    expect(profileRes.data.isFollowedByMe).toBe(false);
  });
});

describe('follows: counts and isFollowedByMe on GET /users/:username', () => {
  it('reflects real follower/following counts after follow/unfollow', async () => {
    await axios.put(
      `/api/v1/users/${owner.credentials.username}/follow`,
      undefined,
      authHeader(followerC.accessToken),
    );

    const ownerProfile = await axios.get(
      `/api/v1/users/${owner.credentials.username}`,
    );
    expect(ownerProfile.data.followersCount).toBeGreaterThanOrEqual(1);

    const followerProfile = await axios.get(
      `/api/v1/users/${followerC.credentials.username}`,
    );
    expect(followerProfile.data.followingCount).toBeGreaterThanOrEqual(1);

    await axios.delete(
      `/api/v1/users/${owner.credentials.username}/follow`,
      authHeader(followerC.accessToken),
    );
    const afterUnfollow = await axios.get(
      `/api/v1/users/${followerC.credentials.username}`,
    );
    expect(afterUnfollow.data.followingCount).toBe(0);
  });
});

describe('follows: GET /users/:username/followers and /following', () => {
  beforeAll(async () => {
    // followerA already follows owner (from the first describe block above);
    // add followerB and followerC too so owner has 3 real followers to page
    // through.
    await Promise.all([
      axios.put(
        `/api/v1/users/${owner.credentials.username}/follow`,
        undefined,
        authHeader(followerB.accessToken),
      ),
      axios.put(
        `/api/v1/users/${owner.credentials.username}/follow`,
        undefined,
        authHeader(followerC.accessToken),
      ),
    ]);
  });

  it("lists owner's followers, paginated with a real keyset cursor", async () => {
    const firstPage = await axios.get(
      `/api/v1/users/${owner.credentials.username}/followers?limit=2`,
    );
    expect(firstPage.status).toBe(200);
    expect(firstPage.data.data).toHaveLength(2);
    expect(firstPage.data.meta.nextCursor).not.toBeNull();

    const secondPage = await axios.get(
      `/api/v1/users/${owner.credentials.username}/followers?limit=2&cursor=${encodeURIComponent(
        firstPage.data.meta.nextCursor,
      )}`,
    );
    expect(secondPage.data.data).toHaveLength(1);
    expect(secondPage.data.meta.nextCursor).toBeNull();

    const allUsernames = [...firstPage.data.data, ...secondPage.data.data].map(
      (item: { username: string }) => item.username,
    );
    expect(allUsernames.sort()).toEqual(
      [
        followerA.credentials.username,
        followerB.credentials.username,
        followerC.credentials.username,
      ].sort(),
    );
  });

  it('lists who followerA follows, including owner', async () => {
    const res = await axios.get(
      `/api/v1/users/${followerA.credentials.username}/following`,
    );

    expect(res.status).toBe(200);
    expect(
      res.data.data.some(
        (item: { username: string }) =>
          item.username === owner.credentials.username,
      ),
    ).toBe(true);
  });

  it('computes isFollowedByMe per row for an authenticated viewer', async () => {
    const res = await axios.get(
      `/api/v1/users/${owner.credentials.username}/followers`,
      authHeader(followerA.accessToken),
    );

    const self = res.data.data.find(
      (item: { username: string }) =>
        item.username === followerA.credentials.username,
    );
    expect(self.isFollowedByMe).toBe(false); // followerA doesn't follow themself
  });

  it('returns null isFollowedByMe for every row to an anonymous viewer', async () => {
    const res = await axios.get(
      `/api/v1/users/${owner.credentials.username}/followers`,
    );

    expect(
      res.data.data.every(
        (item: { isFollowedByMe: null }) => item.isFollowedByMe === null,
      ),
    ).toBe(true);
  });

  it('404s for a followers/following list on a username that does not exist', async () => {
    await expect(
      axios.get('/api/v1/users/no-such-user-e2e/followers'),
    ).rejects.toMatchObject({ response: { status: 404 } });
    await expect(
      axios.get('/api/v1/users/no-such-user-e2e/following'),
    ).rejects.toMatchObject({ response: { status: 404 } });
  });

  it('rejects a malformed cursor with 400', async () => {
    await expect(
      axios.get(
        `/api/v1/users/${owner.credentials.username}/followers?cursor=not-a-real-cursor`,
      ),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });
});

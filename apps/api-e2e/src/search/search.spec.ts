import { randomBytes } from 'node:crypto';

import axios from 'axios';

import { randomRegisterInput } from '../support/random-user';

/**
 * Exercises the real `pg_trgm`-backed User Search pipeline end to end
 * against the live Dockerized Postgres — real accounts, not mocked.
 *
 * Usernames for the ranking-sensitive tests are built around a fresh random
 * token per test run, not `randomRegisterInput()`'s own random usernames —
 * precise control over username content is the whole point here (an exact
 * match vs. a one-character-off fuzzy match), and a random hex token keeps
 * each run's accounts from ever colliding with leftover accounts from
 * earlier runs (including this file's own prior runs) or the seeded
 * alice/bob/carol accounts.
 */

function authHeader(accessToken: string) {
  return { headers: { Authorization: `Bearer ${accessToken}` } };
}

async function registerWithUsername(username: string) {
  const res = await axios.post('/api/v1/auth/register', {
    email: `${username}@example.com`,
    username,
    password: 'Password123!',
  });
  return {
    username,
    accessToken: res.data.accessToken as string,
    user: res.data.user,
  };
}

describe('search: GET /search/users', () => {
  it('ranks an exact username match above a one-character-off fuzzy match', async () => {
    const token = `zz${randomBytes(4).toString('hex')}`;
    const [exact, fuzzy] = await Promise.all([
      registerWithUsername(token),
      registerWithUsername(`${token}x`),
    ]);

    const res = await axios.get(`/api/v1/search/users?q=${token}`);

    const usernames = res.data.data.map(
      (item: { username: string }) => item.username,
    );
    expect(usernames.indexOf(exact.username)).toBeLessThan(
      usernames.indexOf(fuzzy.username),
    );
  });

  it('matches a typo/fuzzy query via trigram similarity, not just exact substring', async () => {
    const token = `zz${randomBytes(4).toString('hex')}suffix`;
    await registerWithUsername(token);

    // One character swapped near the end — not a substring of `token`, so a
    // plain `ILIKE '%query%'` would miss it; pg_trgm's similarity ranking
    // should still surface it.
    const typoQuery = token.slice(0, -1) + 'q';

    const res = await axios.get(`/api/v1/search/users?q=${typoQuery}`);

    expect(
      res.data.data.some(
        (item: { username: string }) => item.username === token,
      ),
    ).toBe(true);
  });

  it('returns no results for a query matching nothing', async () => {
    const res = await axios.get('/api/v1/search/users?q=zzznomatchzzznomatch');
    expect(res.data).toEqual({ data: [], meta: { nextCursor: null } });
  });

  it('rejects a query below the 2-character minimum with 400', async () => {
    await expect(axios.get('/api/v1/search/users?q=a')).rejects.toMatchObject({
      response: { status: 400 },
    });
  });

  it('rejects a missing query with 400', async () => {
    await expect(axios.get('/api/v1/search/users')).rejects.toMatchObject({
      response: { status: 400 },
    });
  });

  it('works anonymously, with isFollowedByMe null', async () => {
    const token = `zz${randomBytes(4).toString('hex')}`;
    await registerWithUsername(token);

    const res = await axios.get(`/api/v1/search/users?q=${token}`);

    expect(res.status).toBe(200);
    expect(
      res.data.data.every(
        (item: { isFollowedByMe: unknown }) => item.isFollowedByMe === null,
      ),
    ).toBe(true);
  });

  it('reports real isFollowedByMe for an authenticated viewer', async () => {
    const token = `zz${randomBytes(4).toString('hex')}`;
    const target = await registerWithUsername(token);
    const viewer = await registerWithUsername(
      `zz${randomBytes(4).toString('hex')}`,
    );
    await axios.put(
      `/api/v1/users/${target.username}/follow`,
      undefined,
      authHeader(viewer.accessToken),
    );

    const res = await axios.get(
      `/api/v1/search/users?q=${token}`,
      authHeader(viewer.accessToken),
    );

    const found = res.data.data.find(
      (item: { username: string }) => item.username === target.username,
    );
    expect(found.isFollowedByMe).toBe(true);
  });

  it('matches on fullName as well as username', async () => {
    const token = `Unique${randomBytes(4).toString('hex')}Name`;
    const credentials = randomRegisterInput();
    const registerRes = await axios.post('/api/v1/auth/register', credentials);
    const accessToken = registerRes.data.accessToken as string;
    await axios.patch(
      '/api/v1/me',
      { fullName: token },
      authHeader(accessToken),
    );

    const res = await axios.get(`/api/v1/search/users?q=${token}`);

    expect(
      res.data.data.some(
        (item: { username: string }) => item.username === credentials.username,
      ),
    ).toBe(true);
  });
});

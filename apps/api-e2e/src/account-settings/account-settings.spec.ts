import axios from 'axios';

import { createTestPrismaClient } from '../support/db';
import { randomRegisterInput } from '../support/random-user';

/**
 * `POST /me/change-password`, `POST /me/change-email`, `DELETE /me`
 * (docs/API.md §13, docs/FEATURES.md #17, Milestone 19) — real accounts
 * against the live Dockerized Postgres, not mocked. Each test registers its
 * own fresh account rather than sharing one across the file: these
 * endpoints mutate credentials/session state directly, so reusing a shared
 * user the way `users/profile.spec.ts` does for read-only assertions would
 * make tests order-dependent.
 */

async function registerUser() {
  const credentials = randomRegisterInput();
  const res = await axios.post('/api/v1/auth/register', credentials);
  return {
    credentials,
    accessToken: res.data.accessToken as string,
    refreshToken: res.data.refreshToken as string,
    user: res.data.user,
  };
}

function authHeader(accessToken: string) {
  return { headers: { Authorization: `Bearer ${accessToken}` } };
}

describe('account settings: POST /me/change-password', () => {
  it('bumps tokenVersion — invalidates another session while the changing session keeps working via its new token pair', async () => {
    const credentials = randomRegisterInput();
    await axios.post('/api/v1/auth/register', credentials);

    // Two independent logins for the same account — two real "devices."
    const sessionA = await axios.post('/api/v1/auth/login', {
      emailOrUsername: credentials.username,
      password: credentials.password,
    });
    const sessionB = await axios.post('/api/v1/auth/login', {
      emailOrUsername: credentials.username,
      password: credentials.password,
    });

    const changeRes = await axios.post(
      '/api/v1/me/change-password',
      { currentPassword: credentials.password, newPassword: 'NewPassword456!' },
      authHeader(sessionA.data.accessToken),
    );
    expect(changeRes.status).toBe(200);
    expect(typeof changeRes.data.accessToken).toBe('string');
    expect(typeof changeRes.data.refreshToken).toBe('string');

    // Session B's old access token is now rejected (tokenVersion mismatch).
    await expect(
      axios.get('/api/v1/auth/session', authHeader(sessionB.data.accessToken)),
    ).rejects.toMatchObject({ response: { status: 401 } });

    // Session B's refresh token is revoked too — not just the access token
    // — otherwise it could silently mint a fresh one and never be forced to
    // re-login (see auth.service.ts's changePassword doc comment).
    await expect(
      axios.post('/api/v1/auth/refresh', {
        refreshToken: sessionB.data.refreshToken,
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });

    // Session A's *new* access token (from the change-password response)
    // works immediately — no forced re-login for the session that made the
    // change.
    const sessionACheck = await axios.get(
      '/api/v1/auth/session',
      authHeader(changeRes.data.accessToken),
    );
    expect(sessionACheck.status).toBe(200);

    // Session A's new refresh token works too (it wasn't also revoked).
    const refreshCheck = await axios.post('/api/v1/auth/refresh', {
      refreshToken: changeRes.data.refreshToken,
    });
    expect(refreshCheck.status).toBe(200);

    // The password genuinely changed: old password now fails login, new one works.
    await expect(
      axios.post('/api/v1/auth/login', {
        emailOrUsername: credentials.username,
        password: credentials.password,
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    const newPasswordLogin = await axios.post('/api/v1/auth/login', {
      emailOrUsername: credentials.username,
      password: 'NewPassword456!',
    });
    expect(newPasswordLogin.status).toBe(200);
  });

  it('rejects an incorrect current password with 401 and leaves the password unchanged', async () => {
    const user = await registerUser();

    await expect(
      axios.post(
        '/api/v1/me/change-password',
        { currentPassword: 'wrong-password', newPassword: 'NewPassword456!' },
        authHeader(user.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 401 } });

    const stillWorks = await axios.post('/api/v1/auth/login', {
      emailOrUsername: user.credentials.username,
      password: user.credentials.password,
    });
    expect(stillWorks.status).toBe(200);
  });

  it('rejects an unauthenticated request with 401', async () => {
    await expect(
      axios.post('/api/v1/me/change-password', {
        currentPassword: 'whatever',
        newPassword: 'NewPassword456!',
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('rejects a too-short new password with 400', async () => {
    const user = await registerUser();

    await expect(
      axios.post(
        '/api/v1/me/change-password',
        { currentPassword: user.credentials.password, newPassword: 'short' },
        authHeader(user.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 400 } });
  });
});

describe('account settings: POST /me/change-email', () => {
  it("changes the email and does not invalidate the caller's own session", async () => {
    const user = await registerUser();
    const newEmail = `${randomRegisterInput().username}@example.com`;

    const res = await axios.post(
      '/api/v1/me/change-email',
      { newEmail, currentPassword: user.credentials.password },
      authHeader(user.accessToken),
    );
    expect(res.status).toBe(200);
    expect(res.data.email).toBe(newEmail);

    // Unlike change-password, no tokenVersion bump — the same access token still works.
    const sessionCheck = await axios.get(
      '/api/v1/auth/session',
      authHeader(user.accessToken),
    );
    expect(sessionCheck.data.user.email).toBe(newEmail);
  });

  it('rejects an incorrect current password with 401', async () => {
    const user = await registerUser();

    await expect(
      axios.post(
        '/api/v1/me/change-email',
        { newEmail: 'someone-new@example.com', currentPassword: 'wrong' },
        authHeader(user.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('rejects an email already taken by another account with 409', async () => {
    const existing = await registerUser();
    const user = await registerUser();

    await expect(
      axios.post(
        '/api/v1/me/change-email',
        {
          newEmail: existing.credentials.email,
          currentPassword: user.credentials.password,
        },
        authHeader(user.accessToken),
      ),
    ).rejects.toMatchObject({ response: { status: 409 } });
  });

  it('rejects an unauthenticated request with 401', async () => {
    await expect(
      axios.post('/api/v1/me/change-email', {
        newEmail: 'someone@example.com',
        currentPassword: 'whatever',
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });
});

describe('account settings: DELETE /me', () => {
  const prisma = createTestPrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('soft-deletes the account — disappears from profile/search reads, row remains in the DB, every session is revoked', async () => {
    const user = await registerUser();
    const { username } = user.credentials;

    // Findable before deletion.
    const profileBefore = await axios.get(`/api/v1/users/${username}`);
    expect(profileBefore.status).toBe(200);
    const searchBefore = await axios.get(
      `/api/v1/search/users?q=${encodeURIComponent(username)}`,
    );
    expect(
      searchBefore.data.data.some(
        (row: { username: string }) => row.username === username,
      ),
    ).toBe(true);

    const deleteRes = await axios.delete('/api/v1/me', {
      ...authHeader(user.accessToken),
      data: { currentPassword: user.credentials.password },
    });
    expect(deleteRes.status).toBe(204);

    // Disappears from public reads.
    await expect(axios.get(`/api/v1/users/${username}`)).rejects.toMatchObject({
      response: { status: 404 },
    });
    const searchAfter = await axios.get(
      `/api/v1/search/users?q=${encodeURIComponent(username)}`,
    );
    expect(
      searchAfter.data.data.some(
        (row: { username: string }) => row.username === username,
      ),
    ).toBe(false);

    // The row itself still exists in the database — a real soft delete, not a hard one.
    const row = await prisma.user.findUnique({ where: { id: user.user.id } });
    expect(row).not.toBeNull();
    expect(row?.deletedAt).not.toBeNull();

    // Every session is revoked: the access token is rejected...
    await expect(
      axios.get('/api/v1/auth/session', authHeader(user.accessToken)),
    ).rejects.toMatchObject({ response: { status: 401 } });
    // ...the refresh token is revoked...
    await expect(
      axios.post('/api/v1/auth/refresh', {
        refreshToken: user.refreshToken,
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    // ...and logging back in with the (still-correct) password fails too.
    await expect(
      axios.post('/api/v1/auth/login', {
        emailOrUsername: username,
        password: user.credentials.password,
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('rejects an incorrect current password with 401 and does not delete the account', async () => {
    const user = await registerUser();

    await expect(
      axios.delete('/api/v1/me', {
        ...authHeader(user.accessToken),
        data: { currentPassword: 'wrong-password' },
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });

    const profileStillThere = await axios.get(
      `/api/v1/users/${user.credentials.username}`,
    );
    expect(profileStillThere.status).toBe(200);
  });

  it('rejects an unauthenticated request with 401', async () => {
    await expect(
      axios.delete('/api/v1/me', { data: { currentPassword: 'whatever' } }),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });
});

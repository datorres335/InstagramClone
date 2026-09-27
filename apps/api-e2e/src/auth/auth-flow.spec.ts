import axios from 'axios';

import { extractCookie } from '../support/cookies';
import { randomRegisterInput } from '../support/random-user';

const REFRESH_COOKIE_NAME = 'refresh_token';

describe('auth: register -> login -> session -> refresh -> logout', () => {
  it('completes the full lifecycle over real HTTP', async () => {
    const credentials = randomRegisterInput();

    const registerRes = await axios.post('/api/v1/auth/register', credentials);
    expect(registerRes.status).toBe(201);
    expect(registerRes.data.user).toMatchObject({
      username: credentials.username,
      email: credentials.email,
    });
    expect(registerRes.data.user.passwordHash).toBeUndefined();
    expect(typeof registerRes.data.accessToken).toBe('string');
    expect(extractCookie(registerRes, REFRESH_COOKIE_NAME)).toBeTruthy();

    const loginRes = await axios.post('/api/v1/auth/login', {
      emailOrUsername: credentials.username,
      password: credentials.password,
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.data.user.id).toBe(registerRes.data.user.id);
    const loginRefreshCookie = extractCookie(loginRes, REFRESH_COOKIE_NAME);
    expect(loginRefreshCookie).toBeTruthy();

    const sessionRes = await axios.get('/api/v1/auth/session', {
      headers: { Authorization: `Bearer ${loginRes.data.accessToken}` },
    });
    expect(sessionRes.status).toBe(200);
    expect(sessionRes.data.user.id).toBe(registerRes.data.user.id);

    const refreshRes = await axios.post(
      '/api/v1/auth/refresh',
      {},
      { headers: { Cookie: `${REFRESH_COOKIE_NAME}=${loginRefreshCookie}` } },
    );
    expect(refreshRes.status).toBe(200);
    expect(typeof refreshRes.data.accessToken).toBe('string');
    const rotatedRefreshCookie = extractCookie(refreshRes, REFRESH_COOKIE_NAME);
    expect(rotatedRefreshCookie).toBeTruthy();
    expect(rotatedRefreshCookie).not.toBe(loginRefreshCookie);

    const logoutRes = await axios.post(
      '/api/v1/auth/logout',
      {},
      { headers: { Cookie: `${REFRESH_COOKIE_NAME}=${rotatedRefreshCookie}` } },
    );
    expect(logoutRes.status).toBe(204);
    expect(extractCookie(logoutRes, REFRESH_COOKIE_NAME)).toBe('');

    await expect(
      axios.post(
        '/api/v1/auth/refresh',
        {},
        {
          headers: { Cookie: `${REFRESH_COOKIE_NAME}=${rotatedRefreshCookie}` },
        },
      ),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('rejects a duplicate registration with a 409 Problem Details response', async () => {
    const credentials = randomRegisterInput();
    await axios.post('/api/v1/auth/register', credentials);

    let error: unknown;
    try {
      await axios.post('/api/v1/auth/register', credentials);
    } catch (caught) {
      error = caught;
    }

    expect(axios.isAxiosError(error)).toBe(true);
    if (!axios.isAxiosError(error) || !error.response) {
      throw new Error('Expected an axios error response');
    }
    expect(error.response.status).toBe(409);
    expect(error.response.headers['content-type']).toContain(
      'application/problem+json',
    );
  });

  it('rejects a wrong password and a nonexistent user with the same 401', async () => {
    const credentials = randomRegisterInput();
    await axios.post('/api/v1/auth/register', credentials);

    await expect(
      axios.post('/api/v1/auth/login', {
        emailOrUsername: credentials.username,
        password: 'wrong-password',
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });

    await expect(
      axios.post('/api/v1/auth/login', {
        emailOrUsername: 'nobody-with-this-username',
        password: 'whatever123',
      }),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('rejects /auth/session with no bearer token', async () => {
    await expect(axios.get('/api/v1/auth/session')).rejects.toMatchObject({
      response: { status: 401 },
    });
  });
});

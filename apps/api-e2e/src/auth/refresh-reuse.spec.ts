import axios from 'axios';

import { extractCookie } from '../support/cookies';
import { randomRegisterInput } from '../support/random-user';

const REFRESH_COOKIE_NAME = 'refresh_token';

function withCookie(token: string) {
  return { headers: { Cookie: `${REFRESH_COOKIE_NAME}=${token}` } };
}

async function expectProblem(
  promise: Promise<unknown>,
  status: number,
  typeSlug: string,
) {
  let error: unknown;
  try {
    await promise;
  } catch (caught) {
    error = caught;
  }
  expect(axios.isAxiosError(error)).toBe(true);
  if (!axios.isAxiosError(error) || !error.response) {
    throw new Error('Expected an axios error response');
  }
  expect(error.response.status).toBe(status);
  expect(error.response.data.type).toBe(
    `https://api.instagram-clone.dev/errors/${typeSlug}`,
  );
}

describe('auth: refresh token reuse detection', () => {
  it('revokes the whole token family once a rotated-away token is replayed', async () => {
    const credentials = randomRegisterInput();
    const registerRes = await axios.post('/api/v1/auth/register', credentials);
    const tokenA = extractCookie(registerRes, REFRESH_COOKIE_NAME);
    if (!tokenA) throw new Error('Expected a refresh cookie from register');

    // Rotate once: A -> B. A is now revoked but not yet "reused".
    const rotateRes = await axios.post(
      '/api/v1/auth/refresh',
      {},
      withCookie(tokenA),
    );
    const tokenB = extractCookie(rotateRes, REFRESH_COOKIE_NAME);
    if (!tokenB) throw new Error('Expected a rotated refresh cookie');
    expect(tokenB).not.toBe(tokenA);

    // Replaying A is reuse of an already-rotated token: 401 + family revoked.
    await expectProblem(
      axios.post('/api/v1/auth/refresh', {}, withCookie(tokenA)),
      401,
      'refresh-token-reused',
    );

    // B was legitimately issued but its family is now revoked as a
    // consequence of the reuse above, so it must be rejected too.
    await expectProblem(
      axios.post('/api/v1/auth/refresh', {}, withCookie(tokenB)),
      401,
      'refresh-token-reused',
    );
  });

  it('rejects an unknown refresh token generically, without a family to revoke', async () => {
    await expect(
      axios.post('/api/v1/auth/refresh', {}, withCookie('not-a-real-token')),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });
});

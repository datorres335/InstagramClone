import axios from 'axios';

import { createTestPrismaClient } from '../support/db';
import { extractCookie } from '../support/cookies';
import { randomRegisterInput } from '../support/random-user';

const REFRESH_COOKIE_NAME = 'refresh_token';

describe('auth: expired refresh token', () => {
  const prisma = createTestPrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects an expired token without treating it as reuse', async () => {
    const credentials = randomRegisterInput();
    const registerRes = await axios.post('/api/v1/auth/register', credentials);
    const token = extractCookie(registerRes, REFRESH_COOKIE_NAME);
    if (!token) throw new Error('Expected a refresh cookie from register');
    const userId: string = registerRes.data.user.id;

    // The API has no way to fast-forward 30 real days, so we backdate the
    // row directly to simulate natural expiry.
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    let error: unknown;
    try {
      await axios.post(
        '/api/v1/auth/refresh',
        {},
        { headers: { Cookie: `${REFRESH_COOKIE_NAME}=${token}` } },
      );
    } catch (caught) {
      error = caught;
    }
    expect(axios.isAxiosError(error)).toBe(true);
    if (!axios.isAxiosError(error) || !error.response) {
      throw new Error('Expected an axios error response');
    }
    // Generic invalid-token error, NOT the reuse-detection type — natural
    // expiry is not suspicious and must not revoke the token family.
    expect(error.response.status).toBe(401);
    expect(error.response.data.type).not.toBe(
      'https://api.instagram-clone.dev/errors/refresh-token-reused',
    );

    // A fresh login for the same user must still work: expiry didn't lock
    // the account or leave the family revoked.
    const loginRes = await axios.post('/api/v1/auth/login', {
      emailOrUsername: credentials.username,
      password: credentials.password,
    });
    expect(loginRes.status).toBe(200);
  });
});

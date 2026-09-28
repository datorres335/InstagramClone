import { parseSessionCookie, serializeSessionCookie } from './session-cookie';

describe('session cookie', () => {
  it('round-trips a full session through serialize/parse', () => {
    const tokens = {
      accessToken: 'access-token',
      accessTokenExpiresAt: '2026-01-01T00:15:00.000Z',
      refreshToken: 'refresh-token',
    };

    expect(parseSessionCookie(serializeSessionCookie(tokens))).toEqual(tokens);
  });

  it('round-trips a session with no cached access token', () => {
    const tokens = {
      accessToken: null,
      accessTokenExpiresAt: null,
      refreshToken: 'refresh-token',
    };

    expect(parseSessionCookie(serializeSessionCookie(tokens))).toEqual(tokens);
  });

  it('returns null for an undefined cookie value', () => {
    expect(parseSessionCookie(undefined)).toBeNull();
  });

  it('returns null for malformed JSON rather than throwing', () => {
    expect(parseSessionCookie('not-json')).toBeNull();
  });

  it('returns null when the parsed value has no refreshToken', () => {
    expect(parseSessionCookie(JSON.stringify({ accessToken: 'x' }))).toBeNull();
  });
});

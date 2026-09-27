/**
 * Access-token payload (docs/ARCHITECTURE.md §7): `sub` (user id) and
 * `tokenVersion` (compared against the user's *current* `tokenVersion` on
 * every request — mismatched means the token was issued before a password
 * change, so it's rejected without needing an access-token allowlist).
 * `iat`/`exp` are added automatically by `@nestjs/jwt`.
 */
export interface JwtPayload {
  sub: string;
  tokenVersion: number;
}

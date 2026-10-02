import { HttpStatus, UnauthorizedException } from '@nestjs/common';

import { HttpProblemException } from '../../common/exceptions/http-problem.exception';

/**
 * A refresh token that was already rotated away (or logged out) got
 * presented again — the standard signal of a stolen/replayed refresh
 * token. The whole token family is revoked when this is thrown (see
 * `TokensService.rotate`) — docs/ARCHITECTURE.md §7, docs/API.md §14.
 */
export class RefreshTokenReusedException extends HttpProblemException {
  constructor() {
    super(
      'refresh-token-reused',
      'Refresh Token Reused',
      HttpStatus.UNAUTHORIZED,
      'This refresh token has already been used. All sessions have been signed out for safety.',
    );
  }
}

/**
 * A refresh token that's simply unknown or past its `expiresAt` — a normal,
 * unremarkable event (the session naturally lapsed), so it does *not*
 * trigger family revocation the way `RefreshTokenReusedException` does.
 * Deliberately the same generic 401 shape as any other `UnauthorizedException`
 * — no need for a dedicated catalog slug for "your session expired."
 */
export class InvalidRefreshTokenException extends UnauthorizedException {
  constructor() {
    super('Invalid or expired refresh token.');
  }
}

/** Login with a wrong password or an email/username that doesn't exist. */
export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super('Invalid email/username or password.');
  }
}

/**
 * The `currentPassword` confirmation on `change-password`/`change-email`/
 * `DELETE /me` (docs/API.md §13, docs/PROGRESS.md Milestone 19) didn't match
 * the stored hash — a distinct message from `InvalidCredentialsException`
 * since the caller is already authenticated here; this is re-confirming an
 * identity already established by the bearer token, not logging in.
 */
export class IncorrectPasswordException extends UnauthorizedException {
  constructor() {
    super('Current password is incorrect.');
  }
}

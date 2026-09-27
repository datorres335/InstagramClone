import { HttpException } from '@nestjs/common';

/**
 * Base class for exceptions that need a specific RFC 7807 `type` slug from
 * the docs/API.md §14 error catalog — e.g. `refresh-token-reused` — rather
 * than the generic status-code-based fallback `HttpExceptionFilter` uses
 * for plain Nest `HttpException`s (`common/filters/http-exception.filter.ts`).
 *
 * Lives in `common/` (not a domain module) so the filter can recognize it
 * without importing from any specific feature — domain modules extend this,
 * `common/` never imports them back.
 */
export class HttpProblemException extends HttpException {
  constructor(
    public readonly problemType: string,
    public readonly problemTitle: string,
    status: number,
    detail: string,
  ) {
    super(detail, status);
  }
}

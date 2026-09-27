import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import type { ZodError } from 'zod';

import { HttpProblemException } from '../exceptions/http-problem.exception';

/** RFC 7807 Problem Details (docs/API.md §1). */
interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  errors?: { path: string; message: string }[];
}

const PROBLEM_BASE_URL = 'https://api.instagram-clone.dev/errors';

/**
 * Maps an HTTP status to the error-catalog slug docs/API.md §14 documents,
 * for plain Nest `HttpException`s that don't need a more specific slug.
 * Business-specific slugs (`refresh-token-reused`, `media-not-ready`, ...)
 * are carried by a `HttpProblemException` subclass instead (checked first,
 * below) — one per business exception, defined in the domain module that
 * throws it (e.g. `modules/auth/exceptions.ts`).
 */
const STATUS_TYPE_SLUGS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'validation-failed',
  [HttpStatus.UNAUTHORIZED]: 'unauthenticated',
  [HttpStatus.FORBIDDEN]: 'forbidden',
  [HttpStatus.NOT_FOUND]: 'not-found',
  [HttpStatus.CONFLICT]: 'conflict',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'payload-too-large',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'unprocessable',
  [HttpStatus.TOO_MANY_REQUESTS]: 'rate-limited',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'service-unavailable',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'internal-error',
};

/**
 * Global exception filter: every error thrown anywhere in the app — a Zod
 * validation failure, a Nest `HttpException`, or a genuinely unexpected
 * error — is turned into the RFC 7807 Problem Details shape docs/API.md §1
 * specifies, instead of Nest's default `{ statusCode, message }` shape.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const problem = this.toProblemDetails(
      exception,
      request.originalUrl ?? request.url,
    );

    if (problem.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
        HttpExceptionFilter.name,
      );
    }

    response
      .status(problem.status)
      .type('application/problem+json')
      .json(problem);
  }

  private toProblemDetails(
    exception: unknown,
    instance: string,
  ): ProblemDetails {
    if (exception instanceof ZodValidationException) {
      // nestjs-zod deliberately types `getZodError()` as `unknown` (kept
      // agnostic between Zod 3/4's slightly different ZodError shapes) —
      // this repo is pinned to Zod 4, so assert that shape explicitly.
      const issues = (exception.getZodError() as ZodError).issues;

      return {
        type: `${PROBLEM_BASE_URL}/validation-failed`,
        title: 'Validation failed',
        status: HttpStatus.BAD_REQUEST,
        detail: issues[0]?.message,
        instance,
        errors: issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      };
    }

    // Checked before the generic `HttpException` branch below, since
    // `HttpProblemException` extends it — a business exception's own
    // `problemType`/`problemTitle` must win over the generic status mapping.
    if (exception instanceof HttpProblemException) {
      return {
        type: `${PROBLEM_BASE_URL}/${exception.problemType}`,
        title: exception.problemTitle,
        status: exception.getStatus(),
        detail: exception.message,
        instance,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const detail = this.extractDetail(body, exception.message);

      return {
        type: `${PROBLEM_BASE_URL}/${STATUS_TYPE_SLUGS[status] ?? 'error'}`,
        title: exception.name.replace(/Exception$/, '') || 'Error',
        status,
        detail,
        instance,
      };
    }

    // Never leak internal error details for unhandled exceptions
    // (docs/API.md §14) — log the real cause, return a generic body.
    return {
      type: `${PROBLEM_BASE_URL}/internal-error`,
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      instance,
    };
  }

  private extractDetail(body: unknown, fallback: string): string {
    if (typeof body === 'string') return body;

    if (body && typeof body === 'object' && 'message' in body) {
      const { message } = body as { message: unknown };
      return Array.isArray(message) ? message.join('; ') : String(message);
    }

    return fallback;
  }
}

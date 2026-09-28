import { ApiError } from '@instagram-clone/api-client';

/** A single user-presentable message from whatever `api-client` threw. */
export function authErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // Prefer the first field-level validation message (docs/API.md §1) —
    // more actionable than the generic "Validation failed" title/detail.
    const fieldError = error.problem.errors?.[0];
    if (fieldError) return fieldError.message;
    return error.problem.detail ?? error.problem.title;
  }
  return 'Something went wrong. Please try again.';
}

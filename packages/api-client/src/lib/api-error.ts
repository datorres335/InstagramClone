/** docs/API.md §1's RFC 7807 error shape. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  errors?: { path: string; message: string }[];
}

/** Thrown for any non-2xx API response. */
export class ApiError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
    this.problem = problem;
  }
}

/** Thrown when an authenticated call is made with no session in storage. */
export class NotAuthenticatedError extends Error {
  constructor() {
    super('No session found.');
    this.name = 'NotAuthenticatedError';
  }
}

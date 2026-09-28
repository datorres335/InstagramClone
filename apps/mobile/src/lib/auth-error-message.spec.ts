import { ApiError } from '@instagram-clone/api-client';

import { authErrorMessage } from './auth-error-message';

describe('authErrorMessage', () => {
  it('prefers the first field-level validation message', () => {
    const error = new ApiError({
      type: 'x',
      title: 'Validation failed',
      status: 400,
      detail: 'Validation failed',
      errors: [
        { path: 'password', message: 'Password must be at least 8 characters' },
      ],
    });

    expect(authErrorMessage(error)).toBe(
      'Password must be at least 8 characters',
    );
  });

  it('falls back to detail when there are no field errors', () => {
    const error = new ApiError({
      type: 'x',
      title: 'Conflict',
      status: 409,
      detail: 'Email or username is already taken.',
    });

    expect(authErrorMessage(error)).toBe('Email or username is already taken.');
  });

  it('falls back to title when there is no detail either', () => {
    const error = new ApiError({
      type: 'x',
      title: 'Unauthenticated',
      status: 401,
    });

    expect(authErrorMessage(error)).toBe('Unauthenticated');
  });

  it('gives a generic message for a non-ApiError', () => {
    expect(authErrorMessage(new Error('ECONNREFUSED'))).toBe(
      'Something went wrong. Please try again.',
    );
  });
});

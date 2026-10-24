import { describe, expect, it } from 'vitest';

import {
  conflictError,
  forbiddenError,
  httpHeadersForError,
  httpStatusForError,
  infrastructureError,
  notFoundError,
  rateLimitedError,
  toErrorResponseBody,
  unauthorizedError,
  unexpectedError,
  validationError,
} from '@lib/errors';
import type { AppError } from '@lib/errors';

const cases: ReadonlyArray<readonly [AppError, number]> = [
  [validationError('c', 'm', {}), 422],
  [notFoundError('c', 'm'), 404],
  [conflictError('c', 'm'), 409],
  [unauthorizedError('c', 'm'), 401],
  [forbiddenError('c', 'm'), 403],
  [rateLimitedError('c', 'm', 3), 429],
  [infrastructureError('c', 'm'), 502],
  [unexpectedError('c', 'm'), 500],
];

describe('httpStatusForError', () => {
  it.each(cases)('maps %j to %i', (error, status) => {
    expect(httpStatusForError(error)).toBe(status);
  });
});

describe('httpHeadersForError', () => {
  it('sends Retry-After for a rate-limited error', () => {
    expect(httpHeadersForError(rateLimitedError('c', 'm', 7))).toEqual({ 'Retry-After': '7' });
  });

  it('sends no header for any other kind', () => {
    expect(httpHeadersForError(notFoundError('c', 'm'))).toEqual({});
  });
});

describe('toErrorResponseBody', () => {
  it('adds the field errors of a validation failure', () => {
    expect(toErrorResponseBody(validationError('c', 'm', { a: ['x'] }))).toEqual({
      code: 'c',
      message: 'm',
      fieldErrors: { a: ['x'] },
    });
  });

  it('adds the retry delay of a rate-limited error', () => {
    expect(toErrorResponseBody(rateLimitedError('c', 'm', 3))).toEqual({
      code: 'c',
      message: 'm',
      retryAfterSeconds: 3,
    });
  });

  it('never exposes the cause', () => {
    const cause = new Error('secret');

    expect(toErrorResponseBody(infrastructureError('c', 'm', cause))).toEqual({
      code: 'c',
      message: 'm',
    });
    expect(toErrorResponseBody(unexpectedError('c', 'm', cause))).toEqual({
      code: 'c',
      message: 'm',
    });
  });

  it.each([notFoundError('c', 'm'), conflictError('c', 'm'), unauthorizedError('c', 'm')])(
    'reduces $kind to code and message',
    (error) => {
      expect(toErrorResponseBody(error)).toEqual({ code: 'c', message: 'm' });
    },
  );

  it('reduces a forbidden error to code and message', () => {
    expect(toErrorResponseBody(forbiddenError('c', 'm'))).toEqual({ code: 'c', message: 'm' });
  });
});

import { describe, expect, it } from 'vitest';

import {
  conflictError,
  forbiddenError,
  infrastructureError,
  matchAppError,
  notFoundError,
  rateLimitedError,
  unauthorizedError,
  unexpectedError,
  validationError,
} from '@lib/errors';
import type { AppError } from '@lib/errors';

describe('error factories', () => {
  it('builds each kind with its code and message', () => {
    expect(validationError('v', 'm', { a: ['x'] })).toEqual({
      kind: 'validation',
      code: 'v',
      message: 'm',
      fieldErrors: { a: ['x'] },
    });
    expect(notFoundError('n', 'm')).toEqual({ kind: 'not_found', code: 'n', message: 'm' });
    expect(conflictError('c', 'm')).toEqual({ kind: 'conflict', code: 'c', message: 'm' });
    expect(unauthorizedError('u', 'm')).toEqual({ kind: 'unauthorized', code: 'u', message: 'm' });
    expect(forbiddenError('f', 'm')).toEqual({ kind: 'forbidden', code: 'f', message: 'm' });
  });

  it('keeps the cause of infrastructure and unexpected errors', () => {
    const cause = new Error('boom');

    expect(infrastructureError('i', 'm', cause)).toMatchObject({ kind: 'infrastructure', cause });
    expect(unexpectedError('x', 'm', cause)).toMatchObject({ kind: 'unexpected', cause });
    expect(infrastructureError('i', 'm').cause).toBeUndefined();
  });

  it.each([
    [0, 1],
    [-5, 1],
    [0.2, 1],
    [1.1, 2],
    [30, 30],
  ])('rounds a retry delay of %s up to %s whole seconds, at least 1', (given, expected) => {
    expect(rateLimitedError('r', 'm', given).retryAfterSeconds).toBe(expected);
  });
});

describe('matchAppError', () => {
  const handlers = {
    validation: () => 'validation',
    not_found: () => 'not_found',
    conflict: () => 'conflict',
    unauthorized: () => 'unauthorized',
    forbidden: () => 'forbidden',
    rate_limited: () => 'rate_limited',
    infrastructure: () => 'infrastructure',
    unexpected: () => 'unexpected',
  };

  it('runs the handler of the error kind with that error', () => {
    const errors: AppError[] = [
      validationError('c', 'm', {}),
      notFoundError('c', 'm'),
      conflictError('c', 'm'),
      unauthorizedError('c', 'm'),
      forbiddenError('c', 'm'),
      rateLimitedError('c', 'm', 1),
      infrastructureError('c', 'm'),
      unexpectedError('c', 'm'),
    ];

    expect(errors.map((error) => matchAppError(error, handlers))).toEqual(
      errors.map((error) => error.kind),
    );
  });

  it('hands the error itself to the handler', () => {
    const error = notFoundError('thing.missing', 'm');

    expect(matchAppError(error, { ...handlers, not_found: (e) => e.code })).toBe('thing.missing');
  });
});

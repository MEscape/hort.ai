import { describe, expect, it } from 'vitest';

import { conflictError, infrastructureError, rateLimitedError, validationError } from '@lib/errors';
import { err, ok, toActionResult } from '@lib/result';

describe('toActionResult', () => {
  it('carries the value of a success', () => {
    expect(toActionResult(ok({ id: 1 }))).toEqual({ ok: true, data: { id: 1 } });
  });

  it('keeps only code and message of an ordinary failure', () => {
    const cause = new Error('db down');

    expect(toActionResult(err(infrastructureError('db.failed', 'Failed.', cause)))).toEqual({
      ok: false,
      error: { code: 'db.failed', message: 'Failed.' },
    });
    expect(toActionResult(err(conflictError('slug.taken', 'Taken.')))).toEqual({
      ok: false,
      error: { code: 'slug.taken', message: 'Taken.' },
    });
  });

  it('adds the field errors of a validation failure', () => {
    const result = toActionResult(
      err(validationError('invalid', 'Invalid.', { name: ['required'] })),
    );

    expect(result).toEqual({
      ok: false,
      error: { code: 'invalid', message: 'Invalid.', fieldErrors: { name: ['required'] } },
    });
  });

  it('adds the retry delay of a rate-limited failure', () => {
    expect(toActionResult(err(rateLimitedError('slow', 'Slow down.', 12)))).toEqual({
      ok: false,
      error: { code: 'slow', message: 'Slow down.', retryAfterSeconds: 12 },
    });
  });

  it('survives a structured clone, as it crosses the Server Action boundary', () => {
    const result = toActionResult(err(rateLimitedError('slow', 'Slow down.', 12)));

    expect(structuredClone(result)).toEqual(result);
  });
});

import { SqlQueryError } from '@prisma/orm-family-sql/errors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { conflictConstraint, createPersistenceFailures, retryTransient } from '@lib/db';
import { conflictError, notFoundError } from '@lib/errors';

interface Line {
  message: string;
  context: Record<string, unknown>;
  error: { name: string; message: string };
}

let stderr: ReturnType<typeof vi.spyOn>;

function logged(): Line[] {
  return (stderr.mock.calls as unknown[][]).map((call) => JSON.parse(String(call[0])) as Line);
}

function sqlError(sqlState?: string, extra: { constraint?: string; table?: string } = {}) {
  return new SqlQueryError('query failed', { ...(sqlState ? { sqlState } : {}), ...extra });
}

/** The way the runtime wraps a driver error: as the `cause` of its own error. */
function wrapped(inner: unknown, depth = 1): Error {
  let error = new Error('runtime', { cause: inner });
  for (let level = 1; level < depth; level += 1) {
    error = new Error('outer', { cause: error });
  }
  return error;
}

const failures = createPersistenceFailures({
  module: 'profile.persistence',
  code: 'profile.persistence_failed',
  subject: 'Profile',
});
const taken = conflictError('profile.slug_taken', 'Taken.');

beforeEach(() => {
  stderr = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('infraOnly', () => {
  it('translates any failure into a generic infrastructure error that keeps the cause', () => {
    const thrown = new Error('connection reset');

    expect(failures.infraOnly('load')(thrown)).toEqual({
      kind: 'infrastructure',
      code: 'profile.persistence_failed',
      message: 'Profile persistence failed during load.',
      cause: thrown,
    });
  });

  it('logs once under the module with the SQL diagnostics but never the detail', () => {
    const thrown = new SqlQueryError('boom', {
      sqlState: '23503',
      constraint: 'fk_owner',
      table: 'profile',
      detail: 'Key (owner)=(secret) is not present',
    });

    failures.infraOnly('save')(wrapped(thrown));

    expect(logged()).toHaveLength(1);
    expect(logged()[0]).toMatchObject({
      message: 'save failed',
      context: {
        module: 'profile.persistence',
        operation: 'save',
        sqlState: '23503',
        constraint: 'fk_owner',
        table: 'profile',
      },
    });
    expect(JSON.stringify(logged())).not.toContain('secret');
  });

  it('logs the error by name and code only, never its message or stack', () => {
    const thrown = Object.assign(new Error('insert failed for "SECRET child text"'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2003',
    });

    failures.infraOnly('save')(wrapped(thrown));
    failures.infraOnly('load')(new Error('SECRET in the message'));

    expect(logged()[0]?.error).toEqual({ name: 'PrismaClientKnownRequestError', message: 'P2003' });
    expect(logged()[1]?.error).toEqual({ name: 'Error', message: 'profile.persistence_failed' });
    expect(JSON.stringify(logged())).not.toContain('SECRET');
  });

  it('logs only the fields the database named', () => {
    failures.infraOnly('save')(sqlError('XX000'));

    expect(logged()[0]?.context).toEqual({
      module: 'profile.persistence',
      operation: 'save',
      sqlState: 'XX000',
    });
  });

  it('logs no diagnostics for a failure that is no SQL error', () => {
    failures.infraOnly('save')('weird');

    expect(logged()[0]?.context).toEqual({ module: 'profile.persistence', operation: 'save' });
  });
});

describe('orConflict', () => {
  const translate = failures.orConflict('create', () => taken);

  it.each([
    ['a unique violation', sqlError('23505')],
    ['an exclusion violation', sqlError('23P01')],
    ['a unique violation wrapped by the runtime', wrapped(sqlError('23505'))],
    ['a unique violation two levels down', wrapped(sqlError('23P01'), 2)],
  ])('answers the conflict for %s without logging', (_name, thrown) => {
    expect(translate(thrown)).toBe(taken);
    expect(logged()).toEqual([]);
  });

  it.each([
    ['a foreign-key violation', sqlError('23503')],
    ['an error without SQL state', sqlError()],
    ['a plain error', new Error('x')],
    ['a non-error', 'x'],
    ['a violation buried deeper than the runtime wraps', wrapped(sqlError('23505'), 6)],
  ])('answers an infrastructure failure for %s and logs it', (_name, thrown) => {
    expect(translate(thrown)).toMatchObject({
      kind: 'infrastructure',
      message: 'Profile persistence failed during create.',
      cause: thrown,
    });
    expect(logged()).toHaveLength(1);
  });

  it('terminates on a cause chain that loops back on itself', () => {
    const loop = new Error('loop');
    loop.cause = loop;

    expect(translate(loop)).toMatchObject({ kind: 'infrastructure' });
  });

  it('passes the thrown value to the conflict factory', () => {
    const thrown = sqlError('23505', { constraint: 'profile_slug_key' });
    const byConstraint = failures.orConflict('create', (value) =>
      conflictError(conflictConstraint(value) ?? 'none', 'Taken.'),
    );

    expect(byConstraint(thrown).code).toBe('profile_slug_key');
  });
});

describe('requireRow', () => {
  const notFound = notFoundError('profile.not_found', 'Missing.');
  const require = failures.requireRow(() => notFound);

  it('turns a null row into the not-found error', () => {
    expect(require(null)._unsafeUnwrapErr()).toBe(notFound);
  });

  it('keeps a row', () => {
    const row = { id: 1 };

    expect(require(row)._unsafeUnwrap()).toBe(row);
  });
});

describe('conflictConstraint', () => {
  it('names the constraint the driver reported, also when wrapped', () => {
    expect(conflictConstraint(sqlError('23505', { constraint: 'a_key' }))).toBe('a_key');
    expect(conflictConstraint(wrapped(sqlError('23505', { constraint: 'b_key' })))).toBe('b_key');
  });

  it('is undefined when the driver names none or there is no driver error', () => {
    expect(conflictConstraint(sqlError('23505'))).toBeUndefined();
    expect(conflictConstraint(new Error('x'))).toBeUndefined();
    expect(conflictConstraint(undefined)).toBeUndefined();
  });
});

describe('retryTransient', () => {
  /** An operation that fails with each of `failures` in turn, then succeeds. */
  function flaky(...thrown: Error[]) {
    let calls = 0;
    // -- the failures under test are deliberately arbitrary thrown values, not only Errors

    const operation = async () => {
      const failure = thrown[calls];
      calls += 1;
      await Promise.resolve();
      if (failure !== undefined) {
        throw failure;
      }
      return 'done';
    };
    return { operation, calls: () => calls };
  }

  it('returns the result of an operation that succeeds', async () => {
    const run = flaky();

    expect(await retryTransient(run.operation)).toBe('done');
    expect(run.calls()).toBe(1);
  });

  it.each([
    ['serialization failure', '40001'],
    ['deadlock', '40P01'],
  ])('runs a %s again', async (_name, sqlState) => {
    const run = flaky(sqlError(sqlState), wrapped(sqlError(sqlState)));

    expect(await retryTransient(run.operation)).toBe('done');
    expect(run.calls()).toBe(3);
  });

  it('gives up after three attempts and throws the last failure', async () => {
    const last = sqlError('40001');
    const run = flaky(sqlError('40001'), sqlError('40P01'), last, sqlError('40001'));

    await expect(retryTransient(run.operation)).rejects.toBe(last);
    expect(run.calls()).toBe(3);
  });

  it.each([
    ['a conflict', sqlError('23505')],
    ['an error without SQL state', sqlError()],
    ['a plain error', new Error('x')],
  ])('throws %s at once', async (_name, failure) => {
    const run = flaky(failure);

    await expect(retryTransient(run.operation)).rejects.toBe(failure);
    expect(run.calls()).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';

import { infrastructureError, unexpectedError } from '@lib/errors';
import {
  combine,
  combineAsync,
  err,
  errAsync,
  fromThrowable,
  fromThrowableAsync,
  ok,
  okAsync,
} from '@lib/result';

const toError = (thrown: unknown) => infrastructureError('boom', 'Failed.', thrown);

describe('fromThrowable', () => {
  it('wraps a returned value', () => {
    expect(fromThrowable(() => 42, toError)._unsafeUnwrap()).toBe(42);
  });

  it('maps a thrown value through the mapper', () => {
    const cause = new Error('x');
    const result = fromThrowable(() => {
      throw cause;
    }, toError);

    expect(result._unsafeUnwrapErr()).toEqual(infrastructureError('boom', 'Failed.', cause));
  });
});

describe('fromThrowableAsync', () => {
  it('wraps a resolved value', async () => {
    const result = await fromThrowableAsync(() => Promise.resolve('a'), toError);

    expect(result._unsafeUnwrap()).toBe('a');
  });

  it('maps a rejection through the mapper', async () => {
    const cause = new Error('rejected');
    const result = await fromThrowableAsync(() => Promise.reject(cause), toError);

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'boom', cause });
  });

  it('catches a function that throws before it produces a promise', async () => {
    const cause = new Error('sync');
    const result = await fromThrowableAsync((): Promise<string> => {
      throw cause;
    }, toError);

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'boom', cause });
  });
});

describe('combine', () => {
  it('collects the values of all results', () => {
    expect(combine([ok(1), ok(2)])._unsafeUnwrap()).toEqual([1, 2]);
  });

  it('short-circuits on the first failure', () => {
    const first = unexpectedError('a', 'A');
    const second = unexpectedError('b', 'B');

    expect(combine([ok(1), err(first), err(second)])._unsafeUnwrapErr()).toBe(first);
  });
});

describe('combineAsync', () => {
  it('collects the values of all async results', async () => {
    const result = await combineAsync([okAsync(1), okAsync(2)]);

    expect(result._unsafeUnwrap()).toEqual([1, 2]);
  });

  it('fails with the first error', async () => {
    const failure = unexpectedError('a', 'A');
    const result = await combineAsync([okAsync(1), errAsync(failure)]);

    expect(result._unsafeUnwrapErr()).toBe(failure);
  });
});

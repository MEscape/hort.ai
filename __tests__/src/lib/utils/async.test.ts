import { afterEach, describe, expect, it, vi } from 'vitest';

import { sleep, TimeoutError, withTimeout } from '@lib/utils';

afterEach(() => {
  vi.useRealTimers();
});

describe('TimeoutError', () => {
  it('carries the limit and a readable message', () => {
    const error = new TimeoutError(250);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('TimeoutError');
    expect(error.timeoutMs).toBe(250);
    expect(error.message).toBe('Operation timed out after 250ms');
  });
});

describe('withTimeout', () => {
  it('resolves with the value and leaves no timer pending', async () => {
    vi.useFakeTimers();
    await expect(withTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('propagates the rejection of the promise', async () => {
    vi.useFakeTimers();
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects with TimeoutError when the promise is too slow', async () => {
    vi.useFakeTimers();
    const slow = new Promise<string>(() => undefined);
    const result = withTimeout(slow, 500);
    const assertion = expect(result).rejects.toMatchObject({
      name: 'TimeoutError',
      timeoutMs: 500,
    });
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
  });

  it('swallows a late rejection of the abandoned promise', async () => {
    vi.useFakeTimers();
    let rejectLate: (reason: Error) => void = () => undefined;
    const late = new Promise<string>((_, reject) => {
      rejectLate = reject;
    });
    const assertion = expect(withTimeout(late, 100)).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    rejectLate(new Error('late'));
    await vi.advanceTimersByTimeAsync(0);
  });
});

describe('sleep', () => {
  it('resolves only after the given time', async () => {
    vi.useFakeTimers();
    let done = false;
    const pending = sleep(200).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(199);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(done).toBe(true);
  });
});

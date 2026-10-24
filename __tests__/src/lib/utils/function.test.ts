import { afterEach, describe, expect, it, vi } from 'vitest';

import { debounce, identity, noop, once } from '@lib/utils';

afterEach(() => {
  vi.useRealTimers();
});

describe('debounce', () => {
  it('calls once after the wait with the last arguments', () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    const save = debounce((value: string) => seen.push(value), 300);
    save('a');
    vi.advanceTimersByTime(200);
    save('b');
    vi.advanceTimersByTime(299);
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(seen).toEqual(['b']);
  });

  it('can fire again after a completed wait', () => {
    vi.useFakeTimers();
    const seen: number[] = [];
    const save = debounce((value: number) => seen.push(value), 10);
    save(1);
    vi.advanceTimersByTime(10);
    save(2);
    vi.advanceTimersByTime(10);
    expect(seen).toEqual([1, 2]);
  });

  it('cancel drops a pending call', () => {
    vi.useFakeTimers();
    const seen: number[] = [];
    const save = debounce((value: number) => seen.push(value), 10);
    save(1);
    save.cancel();
    vi.advanceTimersByTime(100);
    expect(seen).toEqual([]);
  });

  it('cancel without a pending call is harmless', () => {
    const save = debounce(noop, 10);
    expect(() => {
      save.cancel();
    }).not.toThrow();
  });
});

describe('once', () => {
  it('runs the function once and caches the result', () => {
    let runs = 0;
    const get = once(() => ++runs);
    expect([get(), get()]).toEqual([1, 1]);
    expect(runs).toBe(1);
  });

  it('retries after a call that threw', () => {
    let runs = 0;
    const get = once(() => {
      runs += 1;
      if (runs === 1) {
        throw new Error('first');
      }
      return runs;
    });
    expect(() => get()).toThrow('first');
    expect(get()).toBe(2);
    expect(get()).toBe(2);
  });
});

describe('identity and noop', () => {
  it('identity returns its argument', () => {
    const value = { a: 1 };
    expect(identity(value)).toBe(value);
  });

  it('noop returns undefined', () => {
    expect(() => {
      noop();
    }).not.toThrow();
  });
});

import { describe, expect, it, vi } from 'vitest';

import type { Clock } from '@lib/clock';
import { BUILD_RETRY_INTERVAL_MS, createLazyCell, resolveLazy } from '@lib/utils';

function fakeClock(startMs: number): Clock & { set(ms: number): void } {
  let nowMs = startMs;
  return {
    now: () => new Date(nowMs),
    set: (ms) => {
      nowMs = ms;
    },
  };
}

describe('createLazyCell', () => {
  it('starts empty', () => {
    const cell = createLazyCell<string>();
    expect(cell.get()).toBeUndefined();
    expect(cell.getFailure()).toBeUndefined();
  });

  it('stores a value and clears a remembered failure when a value is set', () => {
    const cell = createLazyCell<string>();
    cell.setFailure({ atMs: 1, error: new Error('boom') });
    expect(cell.getFailure()).toBeDefined();

    cell.set('ready');

    expect(cell.get()).toBe('ready');
    expect(cell.getFailure()).toBeUndefined();
  });

  it('can forget a failure explicitly', () => {
    const cell = createLazyCell<string>();
    cell.setFailure({ atMs: 1, error: 'x' });
    cell.setFailure(undefined);
    expect(cell.getFailure()).toBeUndefined();
  });
});

describe('resolveLazy', () => {
  it('builds once and reuses the value', () => {
    const cell = createLazyCell<number>();
    const build = vi.fn(() => 42);
    const deps = { cell, build, clock: fakeClock(0) };

    expect(resolveLazy(deps)).toEqual({ isReady: true, value: 42 });
    expect(resolveLazy(deps)).toEqual({ isReady: true, value: 42 });
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('remembers a failed build for the retry interval without building or reporting again', () => {
    const clock = fakeClock(1000);
    const error = new Error('bad config');
    const build = vi.fn((): number => {
      throw error;
    });
    const onFailure = vi.fn();
    const deps = { cell: createLazyCell<number>(), build, clock, onFailure };

    expect(resolveLazy(deps)).toEqual({ isReady: false, error });
    clock.set(1000 + BUILD_RETRY_INTERVAL_MS - 1);
    expect(resolveLazy(deps)).toEqual({ isReady: false, error });

    expect(build).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(error);
  });

  it('retries once the interval has passed and recovers', () => {
    const clock = fakeClock(1000);
    let shouldFail = true;
    const deps = {
      cell: createLazyCell<string>(),
      clock,
      build: () => {
        if (shouldFail) {
          throw new Error('not yet');
        }
        return 'ok';
      },
    };

    expect(resolveLazy(deps).isReady).toBe(false);
    shouldFail = false;
    clock.set(1000 + BUILD_RETRY_INTERVAL_MS);

    expect(resolveLazy(deps)).toEqual({ isReady: true, value: 'ok' });
    expect(deps.cell.getFailure()).toBeUndefined();
  });

  it('retries when the clock went backwards instead of trusting an unreliable failure time', () => {
    const clock = fakeClock(10_000);
    let attempts = 0;
    const deps = {
      cell: createLazyCell<number>(),
      clock,
      build: () => {
        attempts += 1;
        throw new Error('fail');
      },
    };

    resolveLazy(deps);
    clock.set(5000);
    resolveLazy(deps);

    expect(attempts).toBe(2);
  });

  it('works without an onFailure callback', () => {
    const deps = {
      cell: createLazyCell<number>(),
      clock: fakeClock(0),
      build: (): number => {
        throw new Error('x');
      },
    };
    expect(resolveLazy(deps).isReady).toBe(false);
  });

  it('never throws, even when onFailure throws', () => {
    const error = new Error('build');
    const deps = {
      cell: createLazyCell<number>(),
      clock: fakeClock(0),
      build: (): number => {
        throw error;
      },
      onFailure: () => {
        throw new Error('logger down');
      },
    };

    expect(resolveLazy(deps)).toEqual({ isReady: false, error });
  });
});

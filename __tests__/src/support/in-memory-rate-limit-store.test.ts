import { describe, expect, it } from 'vitest';

import { createFakeClock } from '../lib/rate-limit/fakes';

import { InMemoryRateLimitStore } from './in-memory-rate-limit-store';

describe('InMemoryRateLimitStore', () => {
  it('counts hits within a window and reports the time left, rounded up', async () => {
    const clock = createFakeClock();
    const store = new InMemoryRateLimitStore(clock);

    expect(await store.hit('k', 60)).toEqual({ hits: 1, retryAfterSeconds: 60 });
    clock.advance(1500);
    expect(await store.hit('k', 60)).toEqual({ hits: 2, retryAfterSeconds: 59 });
  });

  it('keeps counters of different keys apart', async () => {
    const store = new InMemoryRateLimitStore(createFakeClock());
    await store.hit('a', 60);

    expect(await store.hit('b', 60)).toMatchObject({ hits: 1 });
  });

  it('does not extend the window with later hits', async () => {
    const clock = createFakeClock();
    const store = new InMemoryRateLimitStore(clock);
    await store.hit('k', 10);
    clock.advance(9000);
    await store.hit('k', 10);
    clock.advance(1000);

    expect(await store.hit('k', 10)).toEqual({ hits: 1, retryAfterSeconds: 10 });
  });

  it('restarts a counter once its window has ended', async () => {
    const clock = createFakeClock();
    const store = new InMemoryRateLimitStore(clock);
    await store.hit('k', 5);
    await store.hit('k', 5);
    clock.advance(5000);

    expect(await store.hit('k', 5)).toEqual({ hits: 1, retryAfterSeconds: 5 });
  });

  it('refuses a new key while the table is full of live counters', async () => {
    const store = new InMemoryRateLimitStore(createFakeClock(), 2);
    await store.hit('a', 60);
    await store.hit('b', 60);

    await expect(store.hit('c', 60)).rejects.toThrow('full');
    expect(await store.hit('a', 60)).toMatchObject({ hits: 2 });
  });

  it('makes room by dropping finished windows first, and keeps the live ones', async () => {
    const clock = createFakeClock();
    const store = new InMemoryRateLimitStore(clock, 3);
    await store.hit('short', 10);
    await store.hit('long', 100);
    await store.hit('longer', 200);
    clock.advance(10_000);

    expect(await store.hit('new', 60)).toMatchObject({ hits: 1 });
    expect(await store.hit('long', 100)).toMatchObject({ hits: 2 });
  });

  it('stays full when the earliest window has not ended yet', async () => {
    const clock = createFakeClock();
    const store = new InMemoryRateLimitStore(clock, 1);
    await store.hit('a', 10);
    clock.advance(9999);

    await expect(store.hit('b', 10)).rejects.toThrow('full');
  });

  it('refuses again after a sweep that found nothing finished', async () => {
    const clock = createFakeClock();
    const store = new InMemoryRateLimitStore(clock, 2);
    await store.hit('short', 10);
    await store.hit('long', 100);
    clock.advance(10_000);
    await store.hit('new', 60);

    await expect(store.hit('other', 60)).rejects.toThrow('full');
    clock.advance(60_000);
    expect(await store.hit('other', 60)).toMatchObject({ hits: 1 });
  });

  it('has room for a large number of keys by default', async () => {
    const store = new InMemoryRateLimitStore(createFakeClock());

    for (let index = 0; index < 100; index += 1) {
      await store.hit(`key-${index}`, 60);
    }

    expect(await store.hit('key-0', 60)).toMatchObject({ hits: 2 });
  });
});

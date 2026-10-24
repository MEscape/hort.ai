import { afterEach, describe, expect, it, vi } from 'vitest';

import { dateToInstant, instantToDate } from '@lib/db';

const DATE = new Date('2026-03-04T05:06:07.089Z');
const ISO = '2026-03-04T05:06:07.089Z';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('instantToDate', () => {
  it('reads the epoch milliseconds of an instant', () => {
    expect(instantToDate({ epochMilliseconds: DATE.getTime() })).toEqual(DATE);
  });
});

describe('dateToInstant', () => {
  it('builds a Temporal.Instant when the runtime has a global Temporal', () => {
    const Instant = Object.assign(() => undefined, { from: (iso: string) => ({ iso }) });
    vi.stubGlobal('Temporal', { Instant });

    expect(dateToInstant(DATE)).toEqual({ iso: ISO });
  });

  it('calls Instant.from as a method of Instant', () => {
    const Instant = Object.assign(() => undefined, {
      tag: 'instant',
      from(this: { tag: string }) {
        return { madeBy: this.tag };
      },
    });
    vi.stubGlobal('Temporal', { Instant });

    expect(dateToInstant(DATE)).toEqual({ madeBy: 'instant' });
  });

  it.each([
    ['no global Temporal', undefined],
    ['a Temporal that is not an object', 5],
    ['a null Temporal', null],
    ['a Temporal without Instant', {}],
    ['an Instant that is not a function', { Instant: 'nope' }],
    ['an Instant that is a plain object', { Instant: { from: () => ({}) } }],
    ['an Instant without from', { Instant: () => undefined }],
    ['a from that is not a function', { Instant: Object.assign(() => undefined, { from: 1 }) }],
    [
      'a from that does not build an object',
      { Instant: Object.assign(() => undefined, { from: () => 'text' }) },
    ],
    ['a from that builds null', { Instant: Object.assign(() => undefined, { from: () => null }) }],
  ])('answers ISO text for %s', (_name, temporal) => {
    vi.stubGlobal('Temporal', temporal);

    expect(dateToInstant(DATE)).toBe(ISO);
  });

  it('round-trips through the real polyfill', async () => {
    await import('temporal-polyfill/global');

    const instant = dateToInstant(DATE);

    expect(typeof instant).toBe('object');
    expect(instantToDate(instant as { epochMilliseconds: number })).toEqual(DATE);
  });
});

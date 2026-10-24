import { describe, expect, it } from 'vitest';

import { toJsonValue } from '@lib/db';
import { JsonStringifyError } from '@lib/utils';

describe('toJsonValue', () => {
  it('returns plain JSON data', () => {
    expect(toJsonValue({ a: [1, 'x', null, true], b: { c: 2.5 } })).toEqual({
      a: [1, 'x', null, true],
      b: { c: 2.5 },
    });
  });

  it('drops undefined members and writes a Date as ISO text', () => {
    const value = toJsonValue({
      keep: 1,
      gone: undefined,
      at: new Date('2026-01-02T03:04:05.000Z'),
    });

    expect(value).toEqual({ keep: 1, at: '2026-01-02T03:04:05.000Z' });
  });

  it('returns a mutable copy, not the readonly input', () => {
    const input = { list: [1] } as const;
    const value = toJsonValue(input);

    expect(value).not.toBe(input);
    expect(value).toEqual({ list: [1] });
  });

  it.each([12n, () => undefined])('throws JsonStringifyError for %s', (value) => {
    expect(() => toJsonValue(value)).toThrow(JsonStringifyError);
  });

  it('throws JsonStringifyError for a cycle', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;

    expect(() => toJsonValue(cyclic)).toThrow(JsonStringifyError);
  });
});

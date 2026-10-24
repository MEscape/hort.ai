import { describe, expect, it } from 'vitest';

import {
  booleanFlag,
  commaSeparatedList,
  httpUrl,
  integerSetting,
  postgresUrl,
} from '@lib/config/env-primitives';

describe('booleanFlag', () => {
  it('reads exactly "true" and "false" and falls back to the default when absent', () => {
    expect(booleanFlag(false).parse('true')).toBe(true);
    expect(booleanFlag(true).parse('false')).toBe(false);
    expect(booleanFlag(true).parse(undefined)).toBe(true);
    expect(booleanFlag(false).parse(undefined)).toBe(false);
  });

  it('rejects every other text instead of coercing it', () => {
    for (const text of ['1', 'yes', 'TRUE', '']) {
      expect(booleanFlag(true).safeParse(text).success).toBe(false);
    }
  });
});

describe('commaSeparatedList', () => {
  it('trims entries and drops empty ones', () => {
    expect(commaSeparatedList.parse(' a , b,, ,c ')).toEqual(['a', 'b', 'c']);
  });

  it('is empty when absent or blank', () => {
    expect(commaSeparatedList.parse(undefined)).toEqual([]);
    expect(commaSeparatedList.parse('')).toEqual([]);
  });
});

describe('integerSetting', () => {
  it('uses the default when absent', () => {
    expect(integerSetting(7).parse(undefined)).toBe(7);
  });

  it('coerces numeric text and requires an integer of at least 1 by default', () => {
    const schema = integerSetting(7);
    expect(schema.parse('12')).toBe(12);
    expect(schema.safeParse('0').success).toBe(false);
    expect(schema.safeParse('1.5').success).toBe(false);
    expect(schema.safeParse('abc').success).toBe(false);
  });

  it('is unbounded above without a max', () => {
    expect(integerSetting(1).parse('999999999')).toBe(999_999_999);
  });

  it('honours custom bounds, both inclusive', () => {
    const schema = integerSetting(5, { min: 3, max: 10 });
    expect(schema.parse('3')).toBe(3);
    expect(schema.parse('10')).toBe(10);
    expect(schema.safeParse('2').success).toBe(false);
    expect(schema.safeParse('11').success).toBe(false);
  });
});

describe('httpUrl', () => {
  it('accepts http and https only', () => {
    expect(httpUrl.safeParse('http://localhost:3000').success).toBe(true);
    expect(httpUrl.safeParse('https://example.org/x').success).toBe(true);
    for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'ftp://example.org', 'nope']) {
      expect(httpUrl.safeParse(url).success).toBe(false);
    }
  });
});

describe('postgresUrl', () => {
  it('accepts postgres and postgresql URLs only', () => {
    expect(postgresUrl.safeParse('postgres://u:p@h:5432/db').success).toBe(true);
    expect(postgresUrl.safeParse('postgresql://u:p@h:5432/db').success).toBe(true);
    expect(postgresUrl.safeParse('mysql://u:p@h/db').success).toBe(false);
    expect(postgresUrl.safeParse('http://h/db').success).toBe(false);
  });
});

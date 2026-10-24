import { describe, expect, it } from 'vitest';

import {
  JsonParseError,
  JsonStringifyError,
  parseJson,
  stableStringify,
  stringifyJson,
} from '@lib/utils';

describe('parseJson', () => {
  it('parses valid JSON', () => {
    expect(parseJson('{"a":[1,null]}')).toEqual({ a: [1, null] });
  });

  it('throws JsonParseError keeping the original cause', () => {
    let caught: unknown;
    try {
      parseJson('{nope');
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(JsonParseError);
    expect(caught).toMatchObject({ name: 'JsonParseError', message: 'Failed to parse JSON' });
    expect((caught as JsonParseError).cause).toBeInstanceOf(SyntaxError);
  });
});

describe('stringifyJson', () => {
  it('serializes, optionally indented', () => {
    expect(stringifyJson({ a: 1 })).toBe('{"a":1}');
    expect(stringifyJson({ a: 1 }, 2)).toBe('{\n  "a": 1\n}');
  });

  it('throws JsonStringifyError for a BigInt and keeps the cause', () => {
    let caught: unknown;
    try {
      stringifyJson(1n);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(JsonStringifyError);
    expect((caught as JsonStringifyError).message).toBe(
      'Failed to stringify JSON: Exception during serialization',
    );
    expect((caught as JsonStringifyError).cause).toBeInstanceOf(TypeError);
  });

  it('throws JsonStringifyError for a cycle', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(() => stringifyJson(cyclic)).toThrow(JsonStringifyError);
  });

  it.each([undefined, () => 1, Symbol('s')])('throws for the unserializable value %s', (value) => {
    const run = (): string => stringifyJson(value);
    expect(run).toThrow('Failed to stringify JSON: Value is not serializable');
    expect(run).toThrow(expect.objectContaining({ name: 'JsonStringifyError', cause: undefined }));
  });
});

describe('stableStringify', () => {
  it('sorts keys at every depth so equal values serialize identically', () => {
    expect(stableStringify({ b: 1, a: { d: [{ z: 1, y: 2 }], c: 'x' } })).toBe(
      '{"a":{"c":"x","d":[{"y":2,"z":1}]},"b":1}',
    );
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });

  it('omits undefined entries in objects but writes null in arrays', () => {
    expect(stableStringify({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(stableStringify([undefined, 1])).toBe('[null,1]');
  });

  it('serializes primitives like JSON.stringify and undefined as null', () => {
    expect(stableStringify('x')).toBe('"x"');
    expect(stableStringify(null)).toBe('null');
    expect(stableStringify(undefined)).toBe('null');
    expect(stableStringify(() => 1)).toBe('null');
  });

  it('delegates non-plain objects to JSON.stringify', () => {
    expect(stableStringify(new Date('2026-01-05T00:00:00Z'))).toBe('"2026-01-05T00:00:00.000Z"');
    expect(stableStringify(new Map([[1, 2]]))).toBe('{}');
  });

  it('escapes keys', () => {
    expect(stableStringify({ 'a"b': 1 })).toBe('{"a\\"b":1}');
  });
});

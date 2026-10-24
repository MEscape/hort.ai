import { describe, expect, it } from 'vitest';

import { assertNever, invariant } from '@lib/utils';

describe('assertNever', () => {
  it('throws with the serialized value', () => {
    expect(() => assertNever({ kind: 'x' } as never)).toThrow('Unexpected value: {"kind":"x"}');
  });

  it('throws the custom message when given', () => {
    expect(() => assertNever('x' as never, 'unknown kind')).toThrow(new Error('unknown kind'));
  });

  it('describes a value with no JSON form via String()', () => {
    expect(() => assertNever(undefined as never)).toThrow('Unexpected value: undefined');
  });

  it('never throws while describing an unserializable value', () => {
    expect(() => assertNever(10n as never)).toThrow('Unexpected value: 10');
  });
});

describe('invariant', () => {
  it('passes for a truthy condition', () => {
    expect(() => {
      invariant(1, 'never shown');
    }).not.toThrow();
  });

  it.each([false, 0, '', null, undefined])('throws for %s', (condition) => {
    expect(() => {
      invariant(condition, 'must hold');
    }).toThrow('Invariant violation: must hold');
  });
});

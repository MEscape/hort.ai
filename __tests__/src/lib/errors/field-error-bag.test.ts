import { describe, expect, it } from 'vitest';

import { FieldErrorBag, validationError } from '@lib/errors';

function newBag(): FieldErrorBag {
  return new FieldErrorBag((fieldErrors) => validationError('invalid', 'Invalid.', fieldErrors));
}

describe('FieldErrorBag', () => {
  it('starts without errors', () => {
    expect(newBag().hasErrors).toBe(false);
    expect(newBag().toError().fieldErrors).toEqual({});
  });

  it('collects every code per path, in order', () => {
    const bag = newBag();
    bag.add('name', 'required');
    bag.add('name', 'too_short');
    bag.add('colors.primary', 'invalid');

    expect(bag.hasErrors).toBe(true);
    expect(bag.toError()).toEqual({
      kind: 'validation',
      code: 'invalid',
      message: 'Invalid.',
      fieldErrors: { name: ['required', 'too_short'], 'colors.primary': ['invalid'] },
    });
  });

  it('records a failed expectation and returns the verdict', () => {
    const bag = newBag();

    expect(bag.expect(true, 'a', 'x')).toBe(true);
    expect(bag.hasErrors).toBe(false);
    expect(bag.expect(false, 'b', 'y')).toBe(false);
    expect(bag.toError().fieldErrors).toEqual({ b: ['y'] });
  });

  it('accepts a path named like a prototype member', () => {
    const bag = newBag();
    bag.add('constructor', 'bad');
    bag.add('constructor', 'worse');

    expect(bag.toError().fieldErrors.constructor).toEqual(['bad', 'worse']);
  });

  it('returns an error that does not alias the bag', () => {
    const bag = newBag();
    bag.add('a', 'x');
    const error = bag.toError();
    bag.add('a', 'y');

    expect(error.fieldErrors['a']).toEqual(['x']);
    expect(bag.toError().fieldErrors['a']).toEqual(['x', 'y']);
  });
});

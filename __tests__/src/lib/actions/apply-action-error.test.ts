import { describe, expect, it } from 'vitest';

import { applyActionError } from '@lib/actions';
import { ROOT_FIELD } from '@lib/errors';
import type { SerializedActionError } from '@lib/result';

import type { UseFormSetError } from 'react-hook-form';

interface Values {
  slug: string;
  name: string;
}

interface Placed {
  field: string;
  message: string | undefined;
  shouldFocus: boolean | undefined;
}

/** A form that records where errors were put. */
function fakeForm() {
  const placed: Placed[] = [];
  const setError: UseFormSetError<Values> = (field, error, options) => {
    placed.push({ field, message: error.message, shouldFocus: options?.shouldFocus });
  };
  return { placed, setError };
}

const base: SerializedActionError = { code: 'profile.invalid', message: 'Invalid.' };

describe('applyActionError', () => {
  it('routes a code to its field and focuses it', () => {
    const form = fakeForm();
    const shown = applyActionError({ ...base, code: 'slug.taken' }, form.setError, {
      'slug.taken': 'slug',
    });

    expect(shown).toBeNull();
    expect(form.placed).toEqual([{ field: 'slug', message: 'slug.taken', shouldFocus: true }]);
  });

  it('places the first code of each field and focuses only the first field', () => {
    const form = fakeForm();
    const shown = applyActionError(
      { ...base, fieldErrors: { name: ['required', 'too_short'], slug: ['invalid'] } },
      form.setError,
    );

    expect(shown).toBeNull();
    expect(form.placed).toEqual([
      { field: 'name', message: 'required', shouldFocus: true },
      { field: 'slug', message: 'invalid', shouldFocus: false },
    ]);
  });

  it('shows the code of a failure whose only field error is the root field', () => {
    const form = fakeForm();
    const shown = applyActionError(
      { ...base, fieldErrors: { [ROOT_FIELD]: ['form_level'] } },
      form.setError,
    );

    expect(form.placed).toEqual([]);
    expect(shown).toBe('profile.invalid');
  });

  it('places nothing for a field without codes', () => {
    const form = fakeForm();

    const shown = applyActionError({ ...base, fieldErrors: { name: [] } }, form.setError);

    expect(form.placed).toEqual([]);
    // Nothing reached a field, so the form-level message still has to be shown.
    expect(shown).toBe('profile.invalid');
  });

  it('returns the code for a form-level message when no field was named', () => {
    const form = fakeForm();

    expect(applyActionError(base, form.setError)).toBe('profile.invalid');
    expect(applyActionError({ ...base, fieldErrors: {} }, form.setError)).toBe('profile.invalid');
    expect(form.placed).toEqual([]);
  });

  it('prefers a routed code over field errors', () => {
    const form = fakeForm();

    applyActionError({ ...base, code: 'slug.taken', fieldErrors: { name: ['x'] } }, form.setError, {
      'slug.taken': 'slug',
    });

    expect(form.placed.map((entry) => entry.field)).toEqual(['slug']);
  });
});

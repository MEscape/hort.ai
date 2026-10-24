import { describe, expect, it } from 'vitest';

import {
  createChildProfileDraft,
  isEmptyChanges,
  parseChildProfileChanges,
} from '@modules/learner/domain/models/child-profile';

const valid = {
  displayName: 'Mia',
  federalState: 'he',
  grade: 3,
  companion: 'max',
  voiceConsent: true,
};

describe('createChildProfileDraft', () => {
  it('accepts a complete input', () => {
    expect(createChildProfileDraft(valid).isOk()).toBe(true);
  });

  it('keeps voice off unless the parent turns it on (#34)', () => {
    const { voiceConsent: _omitted, ...withoutConsent } = valid;
    const result = createChildProfileDraft(withoutConsent);

    expect(result.isOk() && result.value.voiceConsent).toBe(false);
  });

  it('lets the companion be left unchosen', () => {
    const result = createChildProfileDraft({ ...valid, companion: null });

    expect(result.isOk() && result.value.companion).toBeNull();
  });

  it('reports a blank required text field', () => {
    const result = createChildProfileDraft({ ...valid, displayName: '   ' });

    expect(result.isErr() && result.error.fieldErrors['displayName']).toHaveLength(1);
  });

  it('rejects an unknown federal state or companion', () => {
    expect(createChildProfileDraft({ ...valid, federalState: 'nope' }).isErr()).toBe(true);
    expect(createChildProfileDraft({ ...valid, companion: 'hort' }).isErr()).toBe(true);
  });

  it.each([0, 5, 2.5, Number.NaN])('rejects grade %s: primary school is 1 to 4', (grade) => {
    const result = createChildProfileDraft({ ...valid, grade });

    expect(result.isErr() && result.error.fieldErrors['grade']).toHaveLength(1);
  });
});

describe('parseChildProfileChanges', () => {
  it('treats an empty update as no change', () => {
    const result = parseChildProfileChanges({});

    expect(result.isOk() && isEmptyChanges(result.value)).toBe(true);
  });

  it('keeps only the provided fields', () => {
    const result = parseChildProfileChanges({ displayName: 'Mia' });

    expect(result.isOk() && Object.keys(result.value)).toEqual(['displayName']);
  });

  it('rejects a grade outside 1 to 4 on update too', () => {
    expect(parseChildProfileChanges({ grade: 7 }).isErr()).toBe(true);
  });
});

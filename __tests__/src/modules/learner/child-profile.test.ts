import { describe, expect, it } from 'vitest';

import {
  createChildProfileDraft,
  isEmptyChanges,
  parseChildProfileChanges,
} from '@modules/learner/domain/models/child-profile';

const valid = {
  displayName: 'Example displayName',
  federalState: 'bw',
  grade: 1.5,
  companion: 'max',
  voiceConsent: true,
};

describe('createChildProfileDraft', () => {
  it('accepts a complete input', () => {
    expect(createChildProfileDraft(valid).isOk()).toBe(true);
  });

  it('reports a blank required text field', () => {
    const result = createChildProfileDraft({ ...valid, displayName: '   ' });

    expect(result.isErr() && result.error.fieldErrors['displayName']).toHaveLength(1);
  });

  it('rejects an unknown option', () => {
    expect(createChildProfileDraft({ ...valid, federalState: 'nope' }).isErr()).toBe(true);
  });
});

describe('parseChildProfileChanges', () => {
  it('treats an empty update as no change', () => {
    const result = parseChildProfileChanges({});

    expect(result.isOk() && isEmptyChanges(result.value)).toBe(true);
  });

  it('keeps only the provided fields', () => {
    const result = parseChildProfileChanges({ displayName: 'Example displayName' });

    expect(result.isOk() && Object.keys(result.value)).toEqual(['displayName']);
  });
});

import { describe, expect, it } from 'vitest';

import { LEARNER_VALIDATION_CODES } from '@modules/learner/domain/errors/learner-errors';
import { confirmGuardian, createChildDetails } from '@modules/learner/domain/models/child-profile';
import { FEDERAL_STATES, GRADES } from '@modules/learner/domain/models/federal-state';
import { parseChildProfileId } from '@modules/learner/domain/models/ids';
import { LEARNER_LIMITS } from '@modules/learner/domain/models/learner-limits';
import { onboardingStateOf } from '@modules/learner/domain/models/onboarding-state';
import { GUARDIAN_CONSENT_VERSION } from '@modules/learner/domain/models/parent-controls';

import { profileOf } from '../fakes';

const VALID = { displayName: 'Lisa', federalState: 'BY', grade: 2 };

function fieldErrorsOf(input: { displayName: string; federalState: string; grade: number }) {
  const result = createChildDetails(input);
  return result.isErr() ? result.error.fieldErrors : {};
}

describe('createChildDetails', () => {
  it('accepts valid details and trims the display name', () => {
    const result = createChildDetails({ ...VALID, displayName: '  Lisa  ' });

    expect(result._unsafeUnwrap()).toEqual({ displayName: 'Lisa', federalState: 'BY', grade: 2 });
  });

  it.each(FEDERAL_STATES)('accepts the federal state %s', (federalState) => {
    expect(createChildDetails({ ...VALID, federalState }).isOk()).toBe(true);
  });

  it.each(GRADES)('accepts grade %s', (grade) => {
    expect(createChildDetails({ ...VALID, grade }).isOk()).toBe(true);
  });

  it('accepts a name of exactly the maximum length, counted in characters', () => {
    const name = 'ä'.repeat(LEARNER_LIMITS.displayNameMax);

    expect(createChildDetails({ ...VALID, displayName: name }).isOk()).toBe(true);
  });

  it('refuses a blank name and one that is too long', () => {
    expect(fieldErrorsOf({ ...VALID, displayName: '   ' })).toEqual({
      displayName: [LEARNER_VALIDATION_CODES.displayNameRequired],
    });
    expect(
      fieldErrorsOf({ ...VALID, displayName: 'a'.repeat(LEARNER_LIMITS.displayNameMax + 1) }),
    ).toEqual({ displayName: [LEARNER_VALIDATION_CODES.displayNameTooLong] });
  });

  it.each(['Li\nsa', 'Li\u0000sa', 'Li​sa', 'Li‮sa'])(
    'refuses control and invisible format characters in %j',
    (displayName) => {
      expect(fieldErrorsOf({ ...VALID, displayName })).toEqual({
        displayName: [LEARNER_VALIDATION_CODES.displayNameInvalid],
      });
    },
  );

  it.each(['', 'bw', 'XX', 'Bayern'])('refuses the federal state %j', (federalState) => {
    expect(fieldErrorsOf({ ...VALID, federalState })).toEqual({
      federalState: [LEARNER_VALIDATION_CODES.federalStateInvalid],
    });
  });

  it.each([0, 5, 1.5, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses the grade %s',
    (grade) => {
      expect(fieldErrorsOf({ ...VALID, grade })).toEqual({
        grade: [LEARNER_VALIDATION_CODES.gradeInvalid],
      });
    },
  );

  it('reports every invalid field at once', () => {
    const errors = fieldErrorsOf({ displayName: '', federalState: 'XX', grade: 9 });

    expect(Object.keys(errors).sort()).toEqual(['displayName', 'federalState', 'grade']);
  });
});

describe('onboardingStateOf', () => {
  const unfinished = profileOf({ id: 'u', setupCompletedAt: null });
  const finishedOld = profileOf({ id: 'f1', setupCompletedAt: new Date('2026-01-02T00:00:00Z') });
  const finishedNew = profileOf({ id: 'f2', setupCompletedAt: new Date('2026-02-02T00:00:00Z') });

  it('starts at the child step when the parent has no profile', () => {
    expect(onboardingStateOf([])).toEqual({ step: 'child', profile: null });
  });

  it('reports the stored step while the profile is unfinished', () => {
    const reached = profileOf({ id: 'r', setupStep: 'review' });

    expect(onboardingStateOf([unfinished])).toEqual({ step: 'interests', profile: unfinished });
    expect(onboardingStateOf([reached])).toEqual({ step: 'review', profile: reached });
  });

  it('is done once the profile is finished', () => {
    expect(onboardingStateOf([finishedOld])).toEqual({ step: 'done', profile: finishedOld });
  });

  it('prefers the unfinished profile over finished ones, else the oldest finished one', () => {
    expect(onboardingStateOf([finishedOld, unfinished, finishedNew]).profile).toBe(unfinished);
    expect(onboardingStateOf([finishedOld, finishedNew]).profile).toBe(finishedOld);
  });
});

describe('parseChildProfileId', () => {
  it('accepts a plausible id and refuses an empty or oversized one', () => {
    expect(parseChildProfileId('3f1c').isOk()).toBe(true);
    expect(parseChildProfileId('').isErr()).toBe(true);
    expect(parseChildProfileId('x'.repeat(129)).isErr()).toBe(true);
  });
});

describe('confirmGuardian', () => {
  const first = new Date('2026-10-20T08:00:00.000Z');
  const later = new Date('2026-10-24T12:00:00.000Z');

  it('stamps a first confirmation with the current statement version', () => {
    expect(confirmGuardian(null, later)).toEqual({
      confirmedAt: later,
      consentVersion: GUARDIAN_CONSENT_VERSION,
    });
  });

  it('keeps the first confirmation while the statement version is unchanged', () => {
    const previous = { confirmedAt: first, consentVersion: GUARDIAN_CONSENT_VERSION };

    expect(confirmGuardian(previous, later)).toBe(previous);
  });

  it('replaces a confirmation of an older statement version', () => {
    const previous = { confirmedAt: first, consentVersion: '2000-01-01' };

    expect(confirmGuardian(previous, later)).toEqual({
      confirmedAt: later,
      consentVersion: GUARDIAN_CONSENT_VERSION,
    });
  });
});

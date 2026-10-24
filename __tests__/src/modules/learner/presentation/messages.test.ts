import { describe, expect, it } from 'vitest';

import {
  FEDERAL_STATES,
  LEARNER_ERROR_CODES,
  LEARNER_VALIDATION_CODES,
} from '@modules/learner/application/contracts/learner-constraints';
import de from '@modules/learner/presentation/i18n/de.json';
import en from '@modules/learner/presentation/i18n/en.json';
import {
  MESSAGE_KEY_BY_CODE,
  messageKeyForCode,
} from '@modules/learner/presentation/messages/message-keys';

import { getPath } from '@lib/utils';

describe('learner messages', () => {
  it('maps every emitted code to actual English and German messages', () => {
    const codes = [
      ...Object.values(LEARNER_ERROR_CODES),
      ...Object.values(LEARNER_VALIDATION_CODES),
    ];
    expect(Object.keys(MESSAGE_KEY_BY_CODE).sort()).toEqual(codes.sort());
    for (const code of codes) {
      for (const catalog of [en, de]) {
        expect(getPath(catalog.learner, messageKeyForCode(code))).toEqual(expect.any(String));
      }
    }
  });

  it('names every federal state in both languages', () => {
    for (const code of FEDERAL_STATES) {
      expect(en.learner.states[code]).toEqual(expect.any(String));
      expect(de.learner.states[code]).toEqual(expect.any(String));
    }
  });

  it('shows unknown codes as the generic message, never raw', () => {
    for (const code of ['auth.permission_denied', 'constructor', '__proto__']) {
      expect(messageKeyForCode(code)).toBe('errors.unexpected');
    }
  });
});

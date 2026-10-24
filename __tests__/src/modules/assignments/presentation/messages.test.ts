import { describe, expect, it } from 'vitest';

import de from '@modules/assignments/presentation/i18n/de.json';
import en from '@modules/assignments/presentation/i18n/en.json';
import {
  MESSAGE_KEY_BY_CODE,
  messageKeyForCode,
} from '@modules/assignments/presentation/messages/message-keys';
import { ASSIGNMENT_VALIDATION_CODES } from '@modules/assignments/presentation/schemas/assignment-draft-schema';

import { getPath } from '@lib/utils';

describe('assignment validation messages', () => {
  it('maps every validation code to actual English and German messages', () => {
    const codes = Object.values(ASSIGNMENT_VALIDATION_CODES);
    expect(Object.keys(MESSAGE_KEY_BY_CODE).sort()).toEqual([...codes].sort());
    for (const code of codes) {
      for (const catalog of [en, de]) {
        expect(getPath(catalog.assignments, messageKeyForCode(code))).toEqual(expect.any(String));
      }
    }
  });

  it('reads unknown codes and inherited object members as the generic message', () => {
    for (const code of ['Invalid input', 'constructor', '__proto__', 'toString']) {
      expect(messageKeyForCode(code)).toBe('validation.invalid');
    }
    for (const catalog of [en, de]) {
      expect(getPath(catalog.assignments, 'validation.invalid')).toEqual(expect.any(String));
    }
  });
});

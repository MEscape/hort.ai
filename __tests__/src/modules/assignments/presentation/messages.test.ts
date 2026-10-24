import { describe, expect, it } from 'vitest';

import {
  ASSIGNMENTS_ERROR_CODES,
  ASSIGNMENTS_VALIDATION_CODES,
} from '@modules/assignments/application/contracts/assignment-constraints';
import de from '@modules/assignments/presentation/i18n/de.json';
import en from '@modules/assignments/presentation/i18n/en.json';
import {
  GENERIC_ERROR_MESSAGE_KEY,
  MESSAGE_KEY_BY_CODE,
  messageKeyForCode,
} from '@modules/assignments/presentation/messages/message-keys';

import { getPath } from '@lib/utils';

describe('assignment messages', () => {
  it('maps every error and validation code to actual English and German messages', () => {
    const codes = [
      ...Object.values(ASSIGNMENTS_ERROR_CODES),
      ...Object.values(ASSIGNMENTS_VALIDATION_CODES),
    ];
    expect(Object.keys(MESSAGE_KEY_BY_CODE).sort()).toEqual([...codes].sort());
    for (const code of codes) {
      for (const catalog of [en, de]) {
        expect(getPath(catalog.assignments, messageKeyForCode(code))).toEqual(expect.any(String));
      }
    }
  });

  it('reads unknown codes and inherited object members as the generic message', () => {
    for (const code of ['auth.permission_denied', 'Invalid input', 'constructor', '__proto__']) {
      expect(messageKeyForCode(code)).toBe(GENERIC_ERROR_MESSAGE_KEY);
    }
    for (const catalog of [en, de]) {
      expect(getPath(catalog.assignments, GENERIC_ERROR_MESSAGE_KEY)).toEqual(expect.any(String));
    }
  });
});

import { describe, expect, it } from 'vitest';

import {
  PROGRESSION_ERROR_CODES,
  PROGRESSION_VALIDATION_CODES,
} from '@modules/progression/domain/errors/progression-errors';
import de from '@modules/progression/presentation/i18n/de.json';
import en from '@modules/progression/presentation/i18n/en.json';
import {
  MESSAGE_KEY_BY_CODE,
  messageKeyForCode,
} from '@modules/progression/presentation/messages/message-keys';

import { getPath } from '@lib/utils';

describe('progression messages', () => {
  it('maps every emitted code to actual English and German messages', () => {
    const codes = [
      ...Object.values(PROGRESSION_ERROR_CODES),
      ...Object.values(PROGRESSION_VALIDATION_CODES),
    ];
    expect(Object.keys(MESSAGE_KEY_BY_CODE).sort()).toEqual(codes.sort());
    for (const code of codes) {
      for (const catalog of [en, de]) {
        expect(getPath(catalog.progression, messageKeyForCode(code))).toEqual(expect.any(String));
      }
    }
  });

  it('shows unknown codes as the generic message, never raw', () => {
    for (const code of ['auth.permission_denied', 'request_failed', 'constructor', '__proto__']) {
      expect(messageKeyForCode(code)).toBe('errors.unexpected');
    }
  });
});

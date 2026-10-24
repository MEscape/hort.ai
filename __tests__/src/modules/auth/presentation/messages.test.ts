import { describe, expect, it } from 'vitest';

import {
  AUTH_ERROR_CODES,
  AUTH_VALIDATION_CODES,
} from '@modules/auth/application/contracts/auth-constraints';
import de from '@modules/auth/presentation/i18n/de.json';
import en from '@modules/auth/presentation/i18n/en.json';
import {
  MESSAGE_KEY_BY_CODE,
  messageKeyForCode,
} from '@modules/auth/presentation/messages/message-keys';

import { getPath } from '@lib/utils';

describe('authentication error messages', () => {
  it('maps every emitted code to actual English and German messages', () => {
    const codes = [...Object.values(AUTH_ERROR_CODES), ...Object.values(AUTH_VALIDATION_CODES)];
    expect(Object.keys(MESSAGE_KEY_BY_CODE).sort()).toEqual(codes.sort());
    for (const code of codes) {
      for (const catalog of [en, de]) {
        expect(getPath(catalog.auth, messageKeyForCode(code))).toEqual(expect.any(String));
      }
    }
  });

  it('never renders provider details, unknown codes or inherited object members', () => {
    for (const code of ['SQL connection failed', 'constructor', '__proto__', 'toString']) {
      expect(messageKeyForCode(code)).toBe('errors.unexpected');
    }
  });
});

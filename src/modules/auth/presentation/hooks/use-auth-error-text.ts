'use client';

import { useTranslations } from '@i18n/client';

import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';

/**
 * Turns a stable error code (from the server or from a Zod schema) into text in the visitor's
 * language: `undefined` while there is no error. Unknown codes read as the generic message, so a
 * code from somewhere else never shows as a raw key.
 */
export function useAuthErrorText(): (code: string | undefined) => string | undefined {
  const t = useTranslations('auth');

  return (code) => (code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS));
}

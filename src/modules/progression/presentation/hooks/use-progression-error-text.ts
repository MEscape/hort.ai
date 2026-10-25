'use client';

import { useTranslations } from '@i18n/client';

import { messageKeyForCode } from '../messages/message-keys';

/** Turns a stable error code into text in the visitor's language; `undefined` while there is none. */
export function useProgressionErrorText(): (code: string | undefined) => string | undefined {
  const t = useTranslations('progression');

  return (code) => (code === undefined ? undefined : t(messageKeyForCode(code)));
}

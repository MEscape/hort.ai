'use client';

import { useTranslations } from '@i18n/client';

import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';

/** Turns a stable error code into text in the visitor's language; `undefined` while there is none. */
export function useLearnerErrorText(): (code: string | undefined) => string | undefined {
  const t = useTranslations('learner');

  return (code) => (code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS));
}

'use client';

import type { ReactElement, ReactNode } from 'react';

import { getMessageFallback, type Locale } from '@i18n';

import { NextIntlClientProvider, type AbstractIntlMessages, type IntlError } from '@i18n/client';

import { noop } from '@lib/utils';

interface I18nClientProviderProps {
  readonly locale: Locale;
  readonly messages: AbstractIntlMessages;
  readonly timeZone: string;
  readonly isDevelopment: boolean;
  readonly children: ReactNode;
}

function warnInDevelopment(error: IntlError): void {
  console.warn(`[i18n] ${error.code}: ${error.message}`);
}

export function I18nClientProvider({
  locale,
  messages,
  timeZone,
  isDevelopment,
  children,
}: I18nClientProviderProps): ReactElement {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone={timeZone}
      onError={isDevelopment ? warnInDevelopment : noop}
      getMessageFallback={(args) => getMessageFallback(args, isDevelopment)}
    >
      {children}
    </NextIntlClientProvider>
  );
}

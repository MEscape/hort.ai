import 'server-only';
import type { ReactElement, ReactNode } from 'react';

import type { Locale, Namespace } from '@i18n';

import { getLocale, getMessages, getTimeZone } from '@i18n/server';

import { serverEnv } from '@lib/config/server';
import { pick, unique } from '@lib/utils';

import { I18nClientProvider } from './i18n-client-provider';

/** The app shell's own texts: `error.tsx` boundaries are Client Components and need them everywhere. */
const CLIENT_SHELL_NAMESPACES = ['app'] as const satisfies readonly Namespace[];

interface I18nProviderProps {
  /**
   * The locale the caller already knows (the root layout validated it from the URL).
   * Passing it keeps this provider off the request: resolving the locale from headers
   * would make everything below it dynamic.
   */
  readonly locale?: Locale;
  /** Extra namespaces needed by Client Components in this subtree; the shell namespaces are always included. */
  readonly namespaces?: readonly Namespace[];
  readonly children: ReactNode;
}

export async function I18nProvider({
  locale: knownLocale,
  namespaces = [],
  children,
}: I18nProviderProps): Promise<ReactElement> {
  const locale = knownLocale ?? (await getLocale());
  const [messages, timeZone] = await Promise.all([
    getMessages({ locale }),
    getTimeZone({ locale }),
  ]);

  return (
    <I18nClientProvider
      locale={locale}
      messages={pick(messages, unique([...CLIENT_SHELL_NAMESPACES, ...namespaces]))}
      timeZone={timeZone}
      isDevelopment={serverEnv.NODE_ENV !== 'production'}
    >
      {children}
    </I18nClientProvider>
  );
}

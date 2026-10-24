import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import en from '@modules/auth/presentation/i18n/en.json';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import app from '@/i18n/messages/en.json';

export function renderAuth(children: ReactNode) {
  return render(
    <I18nClientProvider
      locale="en"
      messages={{ app, ...en }}
      timeZone="Europe/Berlin"
      isDevelopment
    >
      {children}
    </I18nClientProvider>,
  );
}

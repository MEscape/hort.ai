import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import de from '@modules/learner/presentation/i18n/de.json';
import en from '@modules/learner/presentation/i18n/en.json';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import { CompanionTraits } from '@/app/[locale]/(app)/hello/_components/companion-traits';
import appDe from '@/i18n/messages/de.json';
import appEn from '@/i18n/messages/en.json';

function show(locale: 'de' | 'en', traits: readonly string[]) {
  render(
    <I18nClientProvider
      locale={locale}
      messages={locale === 'de' ? { app: appDe, ...de } : { app: appEn, ...en }}
      timeZone="Europe/Berlin"
      isDevelopment
    >
      <CompanionTraits traits={traits} />
    </I18nClientProvider>,
  );
}

describe('CompanionTraits', () => {
  it('translates the catalog traits into the language of the page', () => {
    show('en', ['treu', 'energiegeladen']);
    expect(screen.getByText('Loyal')).toBeVisible();
    expect(screen.getByText('Energetic')).toBeVisible();
  });

  it('writes them in German in the German page', () => {
    show('de', ['mutig', 'kreativ']);
    expect(screen.getByText('Mutig')).toBeVisible();
    expect(screen.getByText('Kreativ')).toBeVisible();
  });

  it('keeps the word of a trait nobody translated yet, marked as German', () => {
    show('en', ['sportlich', 'treu']);
    expect(screen.getByText('sportlich')).toHaveAttribute('lang', 'de');
  });
});

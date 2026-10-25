'use client';

import { useSearchParams } from 'next/navigation';

import { ToggleGroup, ToggleGroupItem } from '@components/ui/toggle-group';

import { I18N_CONFIG, isLocale, usePathname, useRouter } from '@i18n';

import { useLocale, useTranslations } from '@i18n/client';

/**
 * The interface language. Switching keeps the page and its query (the back arrow's `returnTo`);
 * the locale proxy stores the choice in its one-year cookie, so nothing is saved server-side.
 */
export function LanguageSetting() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const router = useRouter();

  return (
    <ToggleGroup
      type="single"
      value={locale}
      onValueChange={(next) => {
        if (isLocale(next) && next !== locale) {
          router.replace(`${pathname}${search === '' ? '' : `?${search}`}`, { locale: next });
        }
      }}
      aria-label={t('account.languageTitle')}
    >
      {I18N_CONFIG.locales.map((option) => (
        <ToggleGroupItem key={option} value={option} lang={option}>
          {I18N_CONFIG.definitions[option].label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

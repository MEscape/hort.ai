'use client';

import { useSearchParams } from 'next/navigation';

import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@components/ui/dropdown-menu';

import { I18N_CONFIG, isLocale, usePathname, useRouter } from '@i18n';

import { useLocale, useTranslations } from '@i18n/client';

/**
 * EN / DE in the account menu, as menu radio items so arrow keys reach them. Switching keeps the
 * page and its query (the settings back arrow's `returnTo`); the locale proxy stores the choice
 * in its one-year cookie, so nothing is saved server-side.
 */
export function LanguageToggle() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const router = useRouter();

  return (
    <DropdownMenuRadioGroup
      value={locale}
      onValueChange={(next) => {
        if (isLocale(next) && next !== locale) {
          router.replace(`${pathname}${search === '' ? '' : `?${search}`}`, { locale: next });
        }
      }}
      aria-label={t('account.languageTitle')}
      className="flex shrink-0"
    >
      {I18N_CONFIG.locales.map((option) => (
        <DropdownMenuRadioItem
          key={option}
          value={option}
          lang={option}
          aria-label={I18N_CONFIG.definitions[option].label}
          className="relative min-h-11 px-2 text-sm font-semibold text-copy-muted uppercase transition-colors duration-200 hover:text-copy data-[state=checked]:text-primary-copy after:absolute after:inset-x-2 after:bottom-2 after:h-0.5 after:origin-center after:scale-x-0 after:rounded-full after:bg-primary-copy after:transition-transform after:duration-200 after:ease-soft data-[state=checked]:after:scale-x-100 motion-reduce:transition-none motion-reduce:after:transition-none"
        >
          {option}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

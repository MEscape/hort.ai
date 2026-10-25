import { HortaiLogo } from '@components/brand/hortai-logo';
import { Button } from '@components/ui/button';
import { House } from '@components/ui/icons';

import { Link } from '@i18n';

import { getTranslations } from '@i18n/server';

/**
 * The child's header: the logo and a Home button, both back to the parent's home. No account
 * menu here; settings and sign-out belong to the adult area behind it.
 */
export async function StartHeader() {
  const t = await getTranslations('app');
  return (
    <header className="flex w-full items-center justify-between gap-4">
      <Link href="/home" aria-label={t('start.home')} className="rounded-token-sm">
        <HortaiLogo className="h-10 sm:h-12" />
      </Link>
      <Button asChild variant="ghost" size="icon" className="size-12 rounded-full">
        <Link href="/home" aria-label={t('start.home')}>
          <House aria-hidden="true" className="size-6" />
        </Link>
      </Button>
    </header>
  );
}

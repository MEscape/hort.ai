import 'server-only';

import { HortaiLogo } from '@components/brand/hortai-logo';

import { Link } from '@i18n';

import { getTranslations } from '@i18n/server';

import { getAuthQueries, isAuthEnabled } from '../../composition';
import { authRoutes } from '../routes';

import { AccountMenu } from './account-menu';

/**
 * The header of the signed-in areas: the logo leads home, the person's name opens their account
 * menu. Rendering it is not authorization; the account query authorizes itself, and without a
 * session (or with authentication off in development) only the logo shows.
 */
export async function AccountHeader() {
  const t = await getTranslations('auth');
  const result = isAuthEnabled ? await getAuthQueries().getAccount.execute() : null;
  const account = result?.isOk() === true ? result.value : null;

  return (
    <header className="flex w-full items-center justify-between gap-4">
      <Link href={authRoutes.home()} aria-label={t('account.home')} className="rounded-token-sm">
        <HortaiLogo className="h-10 sm:h-12" />
      </Link>
      {account !== null && <AccountMenu name={account.name} role={account.role} />}
    </header>
  );
}

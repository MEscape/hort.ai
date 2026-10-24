import { Button } from '@components/ui/button';

import { Link } from '@i18n';

import { getTranslations } from '@i18n/server';

import { authRoutes } from '../routes';

import { AuthPanel } from './auth-panel';

/**
 * Shown instead of the reset form when the page was opened without a usable token (an incomplete
 * link, or a hand-typed address). A Server Component.
 */
export async function ResetPasswordLinkMissing() {
  const t = await getTranslations('auth');

  return (
    <AuthPanel
      mood="oops"
      title={t('resetPassword.missingTokenTitle')}
      description={t('resetPassword.missingToken')}
    >
      <Button asChild size="lg">
        <Link href={authRoutes.forgotPassword()}>{t('resetPassword.requestNew')}</Link>
      </Button>
    </AuthPanel>
  );
}

import { HortPanel } from '@components/shared/hort-panel';
import { Button } from '@components/ui/button';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { authRoutes } from '../routes';

export interface EmailVerificationResultProps {
  /** True when the provider redirected back with an `error` parameter. */
  readonly hasFailed: boolean;
}

/**
 * The outcome of opening the emailed verification link. On failure the fix is to sign in: the
 * provider then sends a fresh link. Renders on the server or in the browser.
 */
export function EmailVerificationResult({ hasFailed }: EmailVerificationResultProps) {
  const t = useTranslations('auth');

  return (
    <HortPanel
      mood={hasFailed ? 'oops' : 'happy'}
      title={hasFailed ? t('emailVerification.failureTitle') : t('emailVerification.successTitle')}
      description={hasFailed ? t('emailVerification.failure') : t('emailVerification.success')}
    >
      <Button asChild size="lg">
        <Link href={authRoutes.signIn()}>{t('emailVerification.signIn')}</Link>
      </Button>
    </HortPanel>
  );
}

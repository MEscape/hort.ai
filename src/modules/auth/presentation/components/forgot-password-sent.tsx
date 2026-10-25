'use client';

import { useId } from 'react';

import { FieldMessage } from '@components/shared/field-message';
import { FormAlert } from '@components/shared/form-alert';
import { HortPanel } from '@components/shared/hort-panel';
import { Button } from '@components/ui/button';
import { ArrowLeft } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { SECONDS_PER_MINUTE } from '@lib/utils';

import { AUTH_LINK_LIFETIME_SECONDS } from '../../application/contracts/auth-constraints';
import { useResendResetLink } from '../hooks/use-resend-reset-link';
import { authRoutes } from '../routes';

import { AuthLink } from './auth-link';

const LINK_LIFETIME_MINUTES = AUTH_LINK_LIFETIME_SECONDS / SECONDS_PER_MINUTE;

export interface ForgotPasswordSentProps {
  /** Where the link went. */
  readonly email: string;
  /** Back to the form, to correct the address. */
  readonly onChangeAddress: () => void;
}

/**
 * What a person sees after asking for a reset link: where it went, how long it lasts, where to look
 * if it does not come, and a way to ask again after a short wait. The wording is the same whether
 * or not an account exists.
 */
export function ForgotPasswordSent({ email, onChangeAddress }: ForgotPasswordSentProps) {
  const t = useTranslations('auth');
  const id = useId();
  const { secondsLeft, isPending, error, hasResent, resend } = useResendResetLink(email);

  return (
    <HortPanel
      mood="mail"
      shouldTakeFocus
      title={t('forgotPassword.successTitle')}
      description={t('forgotPassword.success', { minutes: LINK_LIFETIME_MINUTES })}
      footer={
        <AuthLink href={authRoutes.signIn()} className="inline-flex items-center gap-2">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('forgotPassword.backToSignIn')}
        </AuthLink>
      }
    >
      <p className="text-center text-copy-muted">{t('forgotPassword.checkSpam')}</p>
      <FormAlert id={`${id}-error`} message={error} />
      {hasResent && (
        <div role="status">
          <FieldMessage id={`${id}-resent`} tone="success">
            {t('forgotPassword.resent')}
          </FieldMessage>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          disabled={isPending || secondsLeft > 0}
          className="sm:flex-1"
          onClick={resend}
        >
          {secondsLeft > 0
            ? t('forgotPassword.resendIn', { seconds: secondsLeft })
            : t('forgotPassword.resend')}
        </Button>
        <Button type="button" variant="ghost" className="sm:flex-1" onClick={onChangeAddress}>
          {t('forgotPassword.differentAddress')}
        </Button>
      </div>
    </HortPanel>
  );
}

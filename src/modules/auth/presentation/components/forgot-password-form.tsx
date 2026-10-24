'use client';

import { useId } from 'react';

import { FormAlert } from '@components/shared/form-alert';
import { HortPanel } from '@components/shared/hort-panel';
import { SubmitButton } from '@components/shared/submit-button';
import { ArrowLeft } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useForgotPasswordForm } from '../hooks/use-forgot-password-form';
import { authRoutes } from '../routes';

import { AuthEmailField } from './auth-email-field';
import { AuthLink } from './auth-link';
import { ForgotPasswordSent } from './forgot-password-sent';

/** Asks for a reset link. The answer is the same whether or not the address has an account. */
export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const id = useId();
  const state = useForgotPasswordForm();
  const { form, errorText, formError, email, sentTo, isPending, mood } = state;
  const { errors, touchedFields } = form.formState;

  if (sentTo !== null) {
    return <ForgotPasswordSent email={sentTo} onChangeAddress={state.changeAddress} />;
  }

  return (
    <HortPanel
      mood={mood}
      title={t('forgotPassword.title')}
      description={t('forgotPassword.description')}
      footer={
        <AuthLink href={authRoutes.signIn()} className="inline-flex items-center gap-2">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('forgotPassword.backToSignIn')}
        </AuthLink>
      }
    >
      <form
        onSubmit={state.onSubmit}
        noValidate
        aria-busy={isPending}
        className="flex flex-col gap-5"
      >
        <AuthEmailField
          id={`${id}-email`}
          label={t('forgotPassword.email')}
          registration={form.register('email')}
          value={email}
          error={errorText(errors.email?.message)}
          isTouched={touchedFields.email === true}
          onAccept={(accepted) => {
            form.setValue('email', accepted, { shouldDirty: true, shouldValidate: true });
          }}
        />
        <FormAlert id={`${id}-form-error`} message={formError} />
        <SubmitButton
          isPending={isPending}
          label={t('forgotPassword.submit')}
          pendingLabel={t('forgotPassword.submitting')}
        />
      </form>
    </HortPanel>
  );
}

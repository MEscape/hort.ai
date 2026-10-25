'use client';

import { useId } from 'react';

import { FormAlert } from '@components/shared/form-alert';
import { HortPanel } from '@components/shared/hort-panel';
import { PasswordField } from '@components/shared/password-field';
import { SubmitButton } from '@components/shared/submit-button';
import { Alert, AlertDescription } from '@components/ui/alert';
import { Info } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useSignInForm } from '../hooks/use-sign-in-form';
import { authRoutes } from '../routes';

import { AuthEmailField } from './auth-email-field';
import { AuthLink } from './auth-link';

export interface SignInFormProps {
  /** Where to go afterwards; the server re-checks it, so this is never trusted. */
  readonly returnTo?: string | undefined;
}

/** A parent signs in. A wrong password is met with a hint, never a scolding, and nothing says which half was wrong. */
export function SignInForm({ returnTo }: SignInFormProps) {
  const t = useTranslations('auth');
  const id = useId();
  const { form, errorText, formError, email, isPending, mood, onSubmit } = useSignInForm(returnTo);
  const { errors, touchedFields } = form.formState;

  return (
    <HortPanel
      mood={mood}
      title={t('signIn.title')}
      description={t('signIn.description')}
      footer={
        <>
          {t('signIn.noAccount')}
          <AuthLink href={authRoutes.signUp()}>{t('signIn.createAccount')}</AuthLink>
        </>
      }
    >
      <form
        method="post"
        onSubmit={onSubmit}
        noValidate
        aria-busy={isPending}
        className="flex flex-col gap-5"
      >
        <fieldset disabled={isPending} className="flex min-w-0 flex-col gap-5">
          {returnTo !== undefined && (
            <Alert variant="info" role="status">
              <Info aria-hidden="true" />
              <AlertDescription>{t('signIn.continueNotice')}</AlertDescription>
            </Alert>
          )}
          <AuthEmailField
            id={`${id}-email`}
            label={t('signIn.email')}
            registration={form.register('email')}
            value={email}
            error={errorText(errors.email?.message)}
            isTouched={touchedFields.email === true}
            onAccept={(accepted) => {
              form.setValue('email', accepted, { shouldDirty: true, shouldValidate: true });
            }}
          />
          <PasswordField
            id={`${id}-password`}
            label={t('signIn.password')}
            autoComplete="current-password"
            labelAction={
              <AuthLink href={authRoutes.forgotPassword()} className="text-base">
                {t('signIn.forgotPassword')}
              </AuthLink>
            }
            error={errorText(errors.password?.message)}
            {...form.register('password')}
          />
          <FormAlert id={`${id}-form-error`} message={formError} />
          <SubmitButton
            isPending={isPending}
            label={t('signIn.submit')}
            pendingLabel={t('signIn.submitting')}
          />
        </fieldset>
      </form>
    </HortPanel>
  );
}

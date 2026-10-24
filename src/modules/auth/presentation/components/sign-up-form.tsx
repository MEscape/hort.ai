'use client';

import { useId } from 'react';

import { TextField } from '@components/shared/text-field';
import { Button } from '@components/ui/button';
import { ShieldCheck } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { useSignUpForm } from '../hooks/use-sign-up-form';
import { authRoutes } from '../routes';

import { AuthEmailField } from './auth-email-field';
import { AuthFormAlert } from './auth-form-alert';
import { AuthLink } from './auth-link';
import { AuthPanel } from './auth-panel';
import { AuthSubmitButton } from './auth-submit-button';
import { NewPasswordFields } from './new-password-fields';
import { NextSteps } from './next-steps';

/**
 * A parent sets up an account: a name to greet them by, an address, a password Hort cheers for,
 * and helpful password guidance. The answer is the same whether or not the address already had an account, so the
 * form cannot be used to find out who is registered; it says "check your inbox" either way.
 */
export function SignUpForm() {
  const t = useTranslations('auth');
  const id = useId();
  const state = useSignUpForm();
  const { form, errorText, formError, watched, assessment, sentTo, isPending, mood } = state;
  const { errors, touchedFields } = form.formState;

  if (sentTo !== null) {
    return (
      <AuthPanel
        mood="mail"
        shouldTakeFocus
        title={t('signUp.successTitle')}
        description={t('signUp.success', { email: sentTo })}
      >
        <NextSteps
          label={t('signUp.steps.label')}
          steps={[
            {
              title: t('signUp.steps.confirm.title'),
              description: t('signUp.steps.confirm.description'),
            },
            {
              title: t('signUp.steps.signIn.title'),
              description: t('signUp.steps.signIn.description'),
            },
          ]}
        />
        <p className="text-center text-copy-muted">{t('signUp.checkSpam')}</p>
        <Button asChild size="lg">
          <Link href={authRoutes.signIn()}>{t('signUp.toSignIn')}</Link>
        </Button>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      mood={mood}
      title={t('signUp.title')}
      description={t('signUp.description')}
      footer={
        <>
          {t('signUp.haveAccount')}
          <AuthLink href={authRoutes.signIn()}>{t('signUp.signInLink')}</AuthLink>
        </>
      }
    >
      <form
        onSubmit={state.onSubmit}
        noValidate
        aria-busy={isPending}
        className="flex flex-col gap-5"
      >
        <fieldset disabled={isPending} className="flex min-w-0 flex-col gap-5">
          <TextField
            id={`${id}-name`}
            label={t('signUp.name')}
            hint={t('signUp.nameHint')}
            autoComplete="given-name"
            isValid={
              touchedFields.name === true && errors.name === undefined && watched.name.trim() !== ''
            }
            error={errorText(errors.name?.message)}
            {...form.register('name')}
          />
          <AuthEmailField
            id={`${id}-email`}
            label={t('signUp.email')}
            registration={form.register('email')}
            value={watched.email}
            error={errorText(errors.email?.message)}
            isTouched={touchedFields.email === true}
            onAccept={(accepted) => {
              form.setValue('email', accepted, { shouldDirty: true, shouldValidate: true });
            }}
          />
          <NewPasswordFields
            id={id}
            passwordLabel={t('signUp.password')}
            confirmLabel={t('signUp.confirmPassword')}
            passwordRegistration={form.register('password', {
              // The repeat is judged again when the password changes, once the person has been there.
              onChange: () => {
                if (touchedFields.confirmPassword === true) {
                  void form.trigger('confirmPassword');
                }
              },
            })}
            confirmRegistration={form.register('confirmPassword')}
            password={watched.password}
            confirmation={watched.confirmPassword}
            assessment={assessment}
            passwordError={errorText(errors.password?.message)}
            confirmError={errorText(errors.confirmPassword?.message)}
          />
          <AuthFormAlert id={`${id}-form-error`} message={formError} />
          <AuthSubmitButton
            isPending={isPending}
            label={t('signUp.submit')}
            pendingLabel={t('signUp.submitting')}
          />
          <p className="flex items-center justify-center gap-2 text-center text-copy-muted">
            <ShieldCheck className="size-5 shrink-0 text-secondary-copy" aria-hidden="true" />
            {t('signUp.safety')}
          </p>
        </fieldset>
      </form>
    </AuthPanel>
  );
}

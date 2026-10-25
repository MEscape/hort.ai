'use client';

import { useId } from 'react';

import { FormAlert } from '@components/shared/form-alert';
import { HortPanel } from '@components/shared/hort-panel';
import { SubmitButton } from '@components/shared/submit-button';
import { Button } from '@components/ui/button';
import { ArrowLeft } from '@components/ui/icons';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { useResetPasswordForm } from '../hooks/use-reset-password-form';
import { authRoutes } from '../routes';

import { AuthLink } from './auth-link';
import { NewPasswordFields } from './new-password-fields';

export interface ResetPasswordFormProps {
  /** From the emailed link. Validated by the page and again by the action. */
  readonly token: string;
}

/** Chooses a new password from an emailed link; Hort cheers once the password is good. */
export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const t = useTranslations('auth');
  const id = useId();
  const state = useResetPasswordForm(token);
  const { form, errorText, formError, watched, assessment, isDone, isPending, mood } = state;
  const { errors, touchedFields } = form.formState;

  if (isDone) {
    return (
      <HortPanel
        mood="happy"
        shouldTakeFocus
        title={t('resetPassword.successTitle')}
        description={t('resetPassword.success')}
      >
        <Button asChild size="lg">
          <Link href={authRoutes.signIn()}>{t('resetPassword.signIn')}</Link>
        </Button>
      </HortPanel>
    );
  }

  return (
    <HortPanel
      mood={mood}
      title={t('resetPassword.title')}
      description={t('resetPassword.description')}
      footer={
        <AuthLink href={authRoutes.signIn()} className="inline-flex items-center gap-2">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t('forgotPassword.backToSignIn')}
        </AuthLink>
      }
    >
      <form
        method="post"
        onSubmit={state.onSubmit}
        noValidate
        aria-busy={isPending}
        className="flex flex-col gap-5"
      >
        <NewPasswordFields
          id={id}
          passwordLabel={t('resetPassword.newPassword')}
          confirmLabel={t('resetPassword.confirmPassword')}
          passwordRegistration={form.register('newPassword', {
            // The repeat is judged again when the password changes, once the person has been there.
            onChange: () => {
              if (touchedFields.confirmPassword === true) {
                void form.trigger('confirmPassword');
              }
            },
          })}
          confirmRegistration={form.register('confirmPassword')}
          password={watched.newPassword}
          confirmation={watched.confirmPassword}
          assessment={assessment}
          passwordError={errorText(errors.newPassword?.message)}
          confirmError={errorText(errors.confirmPassword?.message)}
        />
        <FormAlert id={`${id}-form-error`} message={formError} />
        <SubmitButton
          isPending={isPending}
          label={t('resetPassword.submit')}
          pendingLabel={t('resetPassword.submitting')}
        />
      </form>
    </HortPanel>
  );
}

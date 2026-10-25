'use client';

import { useId } from 'react';

import { useFormState } from 'react-hook-form';

import { FormAlert } from '@components/shared/form-alert';
import { PasswordField } from '@components/shared/password-field';
import { SubmitButton } from '@components/shared/submit-button';

import { useTranslations } from '@i18n/client';

import { usePasswordChangeForm } from '../hooks/use-password-change-form';

import { NewPasswordFields } from './new-password-fields';

/** The current password, then a new one with the same guidance and repeat as at sign-up. */
export function PasswordChangeForm() {
  const t = useTranslations('auth');
  const id = useId();
  const state = usePasswordChangeForm();
  const { errors, touchedFields } = useFormState({ control: state.form.control });

  return (
    <form
      method="post"
      onSubmit={state.onSubmit}
      noValidate
      aria-busy={state.isPending}
      className="flex flex-col gap-5"
    >
      <PasswordField
        id={`${id}-current`}
        label={t('account.currentPassword')}
        autoComplete="current-password"
        error={state.errorText(errors.currentPassword?.message)}
        {...state.form.register('currentPassword')}
      />
      <NewPasswordFields
        id={id}
        passwordLabel={t('account.newPassword')}
        confirmLabel={t('account.confirmPassword')}
        passwordRegistration={state.form.register('newPassword', {
          onChange: () => {
            if (touchedFields.confirmPassword === true) {
              void state.form.trigger('confirmPassword');
            }
          },
        })}
        confirmRegistration={state.form.register('confirmPassword')}
        password={state.watched.newPassword}
        confirmation={state.watched.confirmPassword}
        assessment={state.assessment}
        passwordError={state.errorText(errors.newPassword?.message)}
        confirmError={state.errorText(errors.confirmPassword?.message)}
      />
      <FormAlert id={`${id}-form-error`} message={state.formError} />
      <p role="status" className="text-sm font-semibold text-primary-copy empty:sr-only">
        {state.isChanged && t('account.passwordChanged')}
      </p>
      <SubmitButton
        isPending={state.isPending}
        label={t('account.changePassword')}
        pendingLabel={t('account.saving')}
        className="self-start"
      />
    </form>
  );
}

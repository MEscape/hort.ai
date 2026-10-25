'use client';

import { useId } from 'react';

import { useFormState } from 'react-hook-form';

import { FormAlert } from '@components/shared/form-alert';
import { SubmitButton } from '@components/shared/submit-button';
import { TextField } from '@components/shared/text-field';

import { useTranslations } from '@i18n/client';

import { CREDENTIAL_LIMITS } from '../../application/contracts/auth-constraints';
import { useDisplayNameForm } from '../hooks/use-display-name-form';

/** The display name, the one account field a person may change themselves. */
export function DisplayNameForm({ currentName }: { readonly currentName: string }) {
  const t = useTranslations('auth');
  const id = useId();
  const state = useDisplayNameForm(currentName);
  const { errors } = useFormState({ control: state.form.control });

  return (
    <form
      onSubmit={state.onSubmit}
      noValidate
      aria-busy={state.isPending}
      className="flex flex-col gap-4"
    >
      <TextField
        id={`${id}-name`}
        label={t('account.nameLabel')}
        hint={t('signUp.nameHint')}
        autoComplete="name"
        maxLength={CREDENTIAL_LIMITS.nameMax}
        error={state.errorText(errors.name?.message)}
        {...state.form.register('name')}
      />
      <FormAlert id={`${id}-form-error`} message={state.formError} />
      <p role="status" className="text-sm font-semibold text-primary-copy empty:sr-only">
        {state.isSaved && t('account.nameSaved')}
      </p>
      <SubmitButton
        isPending={state.isPending}
        label={t('account.saveName')}
        pendingLabel={t('account.saving')}
        className="self-start"
      />
    </form>
  );
}

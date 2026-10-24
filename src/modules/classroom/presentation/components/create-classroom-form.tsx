'use client';

import { useId } from 'react';

import { useFormState } from 'react-hook-form';

import { TextField } from '@components/shared/text-field';
import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { CircleCheck, TriangleAlert } from '@components/ui/icons';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { useFocusOnMount } from '@/hooks/use-focus-on-mount';

import { CLASSROOM_LIMITS } from '../../application/contracts/classroom-constraints';
import { useCreateClassroomForm } from '../hooks/use-create-classroom-form';

/** A teacher's first class: name and grade. Afterwards the invite code is shown exactly once. */
export function CreateClassroomForm() {
  const t = useTranslations('classroom');
  const id = useId();
  const router = useRouter();
  const state = useCreateClassroomForm();
  const { errors } = useFormState({ control: state.form.control });
  const codeRef = useFocusOnMount<HTMLDivElement>(state.inviteCode !== null);

  if (state.inviteCode !== null) {
    return (
      <Alert variant="success" ref={codeRef} tabIndex={-1}>
        <CircleCheck aria-hidden="true" />
        <AlertTitle>{t('create.createdTitle')}</AlertTitle>
        <AlertDescription>
          <p>{t('create.codeHint')}</p>
          <p className="my-3 font-heading text-3xl tracking-widest text-copy">
            <span className="sr-only">{t('create.codeLabel')} </span>
            {state.inviteCode}
          </p>
          <Button
            type="button"
            onClick={() => {
              router.refresh();
            }}
          >
            {t('create.continue')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={state.onSubmit} noValidate aria-busy={state.isPending} className="space-y-5">
      {state.formError !== undefined && (
        <Alert variant="nudge" role="alert">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}
      <fieldset disabled={state.isPending} className="grid min-w-0 gap-5 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <TextField
            id={`${id}-name`}
            label={t('create.nameLabel')}
            hint={t('create.nameHint')}
            required
            maxLength={CLASSROOM_LIMITS.nameMax}
            autoComplete="off"
            error={state.errorText(errors.name?.message)}
            {...state.form.register('name')}
          />
        </div>
        <TextField
          id={`${id}-grade`}
          type="number"
          inputMode="numeric"
          min={CLASSROOM_LIMITS.gradeMin}
          max={CLASSROOM_LIMITS.gradeMax}
          label={t('create.gradeLabel')}
          required
          error={state.errorText(errors.grade?.message)}
          {...state.form.register('grade', { valueAsNumber: true })}
        />
      </fieldset>
      <p className="text-sm text-copy-muted">{t('create.scopeNote')}</p>
      <Button type="submit" disabled={state.isPending}>
        {state.isPending ? t('create.submitting') : t('create.submit')}
      </Button>
    </form>
  );
}

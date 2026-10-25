'use client';

import { useId } from 'react';

import { useFormState } from 'react-hook-form';

import { TextField } from '@components/shared/text-field';
import { Alert, AlertDescription } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { TriangleAlert } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { CLASSROOM_LIMITS } from '../../application/contracts/classroom-constraints';
import { useCreateClassroomForm } from '../hooks/use-create-classroom-form';

interface CreateClassroomFormProps {
  /** Called once the class exists (the add-class dialog closes); the code dialog takes over. */
  readonly onCreated?: () => void;
}

/**
 * A new class: name and grade. The invite code is shown by `ClassroomCreationProvider`'s dialog,
 * which must be rendered above this form.
 */
export function CreateClassroomForm({ onCreated }: CreateClassroomFormProps) {
  const t = useTranslations('classroom');
  const id = useId();
  const state = useCreateClassroomForm(onCreated);
  const { errors } = useFormState({ control: state.form.control });

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

'use client';

import { useId } from 'react';

import { Controller } from 'react-hook-form';

import { ChoiceGroup } from '@components/shared/choice-group';
import { SelectField } from '@components/shared/select-field';
import { TextField } from '@components/shared/text-field';
import { ShieldCheck } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { FEDERAL_STATES } from '../../application/contracts/learner-constraints';
import { useChildProfileForm } from '../hooks/use-child-profile-form';
import { GRADE_CHOICES } from '../schemas/child-profile-schema';

import { StepFrame } from './step-frame';

import type { ChildProfileDto } from '../dto/learner-dto';

export interface ChildProfileStepProps {
  readonly stepNumber: number;
  readonly shouldTakeFocus: boolean;
  readonly profile: ChildProfileDto | null;
  readonly onBack: () => void;
  readonly onSaved: (saved: ChildProfileDto) => void;
}

/**
 * The only identity Hort keeps about a child: what to call them, the federal state and the grade. A
 * refusal from the server stays on the screen with the input kept; sending twice corrects the same
 * profile instead of adding another.
 */
export function ChildProfileStep({
  stepNumber,
  shouldTakeFocus,
  profile,
  onBack,
  onSaved,
}: ChildProfileStepProps) {
  const t = useTranslations('learner');
  const id = useId();
  const { form, errorText, formError, isPending, onSubmit } = useChildProfileForm(profile, onSaved);
  const { errors, touchedFields } = form.formState;

  return (
    <StepFrame
      stepNumber={stepNumber}
      shouldTakeFocus={shouldTakeFocus}
      title={t('child.title')}
      description={t('child.description')}
      onSubmit={onSubmit}
      isPending={isPending}
      formError={formError}
      submitLabel={t('child.submit')}
      onBack={onBack}
    >
      <TextField
        id={`${id}-name`}
        label={t('child.displayName')}
        hint={t('child.displayNameHint')}
        autoComplete="off"
        isValid={touchedFields.displayName === true && errors.displayName === undefined}
        error={errorText(errors.displayName?.message)}
        {...form.register('displayName')}
      />
      <Controller
        control={form.control}
        name="federalState"
        render={({ field }) => (
          <SelectField
            id={`${id}-state`}
            name={field.name}
            label={t('child.federalState')}
            hint={t('child.federalStateHint')}
            placeholder={t('child.federalStatePlaceholder')}
            options={FEDERAL_STATES.map((code) => ({ value: code, label: t(`states.${code}`) }))}
            value={field.value}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            error={errorText(errors.federalState?.message)}
          />
        )}
      />
      <ChoiceGroup
        id={`${id}-grade`}
        legend={t('child.grade')}
        isCompact
        options={GRADE_CHOICES.map((grade) => ({
          value: grade,
          label: t('child.gradeOption', { grade }),
        }))}
        radioProps={form.register('grade')}
        error={errorText(errors.grade?.message)}
      />
      <p className="flex items-start gap-3 text-copy-muted">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-secondary-copy" aria-hidden="true" />
        {t('child.privacy')}
      </p>
    </StepFrame>
  );
}

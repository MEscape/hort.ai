'use client';

import { useId } from 'react';

import { useTranslations } from '@i18n/client';

import { useTutorForm } from '../hooks/use-tutor-form';

import { StepFrame } from './step-frame';
import { TutorPicker } from './tutor-picker';

import type { TutorOption } from './tutor-option';
import type { ChildProfileDto } from '../dto/learner-dto';

export interface TutorStepProps {
  readonly stepNumber: number;
  readonly shouldTakeFocus: boolean;
  readonly profile: ChildProfileDto;
  readonly tutors: readonly TutorOption[];
  readonly onBack: () => void;
  readonly onSaved: (saved: ChildProfileDto) => void;
}

/**
 * The parent picks who will help the child and can hear each companion introduce themselves.
 * Nothing is preselected: a companion is a relationship, not a default. Companions that share the
 * child's interests are marked as a fit, never forced.
 */
export function TutorStep({
  stepNumber,
  shouldTakeFocus,
  profile,
  tutors,
  onBack,
  onSaved,
}: TutorStepProps) {
  const t = useTranslations('learner');
  const id = useId();
  const { form, errorText, formError, isPending, onSubmit } = useTutorForm(profile, onSaved);

  return (
    <StepFrame
      stepNumber={stepNumber}
      shouldTakeFocus={shouldTakeFocus}
      title={t('tutor.title', { name: profile.displayName })}
      description={t('tutor.description')}
      onSubmit={onSubmit}
      isPending={isPending}
      formError={formError}
      submitLabel={t('tutor.submit')}
      onBack={onBack}
    >
      <TutorPicker
        tutors={tutors}
        interests={profile.interests}
        name={profile.displayName}
        control={form.control}
        registration={form.register('tutorId')}
        errorId={`${id}-error`}
        error={errorText(form.formState.errors.tutorId?.message)}
      />
    </StepFrame>
  );
}

'use client';

import { useId } from 'react';

import { FieldMessage } from '@components/shared/field-message';

import { useTranslations } from '@i18n/client';

import { useTutorForm } from '../hooks/use-tutor-form';

import { INTEREST_TOPICS } from './interest-icons';
import { StepFrame } from './step-frame';
import { TutorChoice } from './tutor-choice';

import type { TutorOption } from './tutor-option';
import type { Interest } from '../../application/contracts/learner-constraints';
import type { ChildProfileDto } from '../dto/learner-dto';

export interface TutorStepProps {
  readonly stepNumber: number;
  readonly shouldTakeFocus: boolean;
  readonly profile: ChildProfileDto;
  readonly tutors: readonly TutorOption[];
  readonly onBack: () => void;
  readonly onSaved: (saved: ChildProfileDto) => void;
}

/** The interests of the child that a companion likes too: these make the recommendation. */
function sharedInterests(tutor: TutorOption, interests: readonly string[]): Interest[] {
  return (interests as Interest[]).filter((interest) =>
    INTEREST_TOPICS[interest].some((topic) => tutor.topics.includes(topic)),
  );
}

/**
 * The parent picks who will help the child. Nothing is preselected: a companion is a relationship,
 * not a default. Companions that share the child's interests are marked as a fit, never forced.
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
  const matches = tutors.map((tutor) => sharedInterests(tutor, profile.interests));
  const best = Math.max(0, ...matches.map((shared) => shared.length));

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
      <fieldset className="flex min-w-0 flex-col gap-4">
        <p className="text-sm text-copy-muted">{t('tutor.languageNote')}</p>
        <legend className="sr-only">{t('tutor.groupLabel', { name: profile.displayName })}</legend>
        {tutors.map((tutor, index) => (
          <TutorChoice
            key={tutor.id}
            tutor={tutor}
            fits={
              best > 0 && matches[index]?.length === best
                ? (matches[index] ?? []).map((interest) => t(`interests.items.${interest}`))
                : []
            }
            radioProps={form.register('tutorId')}
          />
        ))}
        <FieldMessage id={`${id}-error`}>
          {errorText(form.formState.errors.tutorId?.message)}
        </FieldMessage>
      </fieldset>
    </StepFrame>
  );
}

'use client';

import { useWatch } from 'react-hook-form';

import { FieldMessage } from '@components/shared/field-message';

import { useTranslations } from '@i18n/client';

import { bestFits } from './tutor-fit';
import { TutorStage } from './tutor-stage';
import { TutorTile } from './tutor-tile';

import type { TutorOption } from './tutor-option';
import type { TutorForm } from '../schemas/onboarding-schema';
import type { Control, UseFormRegisterReturn } from 'react-hook-form';

export interface TutorPickerProps {
  readonly tutors: readonly TutorOption[];
  /** The child's interests: the companions that share them are marked as a fit. */
  readonly interests: readonly string[];
  readonly name: string;
  readonly control: Control<TutorForm>;
  readonly registration: UseFormRegisterReturn<'tutorId'>;
  readonly errorId: string;
  readonly error: string | undefined;
}

/**
 * The companions as a row of big tiles (a swipeable row on a phone, three columns from `sm`), and
 * below it the chosen one up close with the spoken introduction. Nothing is chosen at first: the
 * area below says "tap a companion" until the parent does.
 */
export function TutorPicker({
  tutors,
  interests,
  name,
  control,
  registration,
  errorId,
  error,
}: TutorPickerProps) {
  const t = useTranslations('learner');
  const selectedId = useWatch({ control, name: 'tutorId' });
  const fits = bestFits(tutors, interests);
  const selected = tutors.find((tutor) => tutor.id === selectedId);

  return (
    <fieldset className="flex min-w-0 flex-col gap-5">
      <legend className="sr-only">{t('tutor.groupLabel', { name })}</legend>
      <p className="text-sm text-copy-muted">{t('tutor.languageNote')}</p>
      <div className="-mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pt-1 pb-3 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0">
        {tutors.map((tutor) => (
          <TutorTile
            key={tutor.id}
            tutor={tutor}
            fits={(fits.get(tutor.id) ?? []).map((interest) => t(`interests.items.${interest}`))}
            radioProps={registration}
          />
        ))}
      </div>
      <FieldMessage id={errorId}>{error}</FieldMessage>
      {selected === undefined ? (
        <p className="rounded-token-xl border-2 border-dashed border-border-strong p-5 text-center text-copy-muted">
          {t('tutor.pick')}
        </p>
      ) : (
        <TutorStage key={selected.id} tutor={selected} />
      )}
    </fieldset>
  );
}

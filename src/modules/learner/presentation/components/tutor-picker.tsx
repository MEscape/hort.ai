'use client';

import { useWatch } from 'react-hook-form';

import { FieldMessage } from '@components/shared/field-message';

import { useCharacterVoice } from '@hooks/use-character-voice';

import { useTranslations } from '@i18n/client';

import { TutorDetails } from './tutor-details';
import { TutorFigure } from './tutor-figure';
import { bestFits } from './tutor-fit';

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
 * The companions standing in a stage (they rise above its box), and below it the chosen one up
 * close with a button for the spoken introduction. Nothing is chosen at first: the area below says
 * "tap a companion". The voice lives here because the figure (its mouth) and the details (the
 * button) both need it; it re-renders this screen only when the sound starts or stops, while the
 * mouth moves inside the chosen figure alone.
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
  const selected = tutors.find((tutor) => tutor.id === selectedId);
  const voice = useCharacterVoice(selected?.introUrl ?? '');
  const fits = bestFits(tutors, interests);
  const fitLabels = (id: string) =>
    (fits.get(id) ?? []).map((interest) => t(`interests.items.${interest}`));

  return (
    <fieldset className="flex min-w-0 flex-col gap-6">
      <legend className="sr-only">{t('tutor.groupLabel', { name })}</legend>
      <p className="text-sm text-copy-muted">{t('tutor.languageNote')}</p>
      <div className="mt-14 flex items-end justify-center gap-2 rounded-token-xl border border-border bg-highlight/70 px-3 pb-5 sm:mt-24 sm:gap-8 sm:px-8">
        {tutors.map((tutor) => (
          <TutorFigure
            key={tutor.id}
            tutor={tutor}
            isSelected={tutor.id === selectedId}
            isSpeaking={voice.status === 'playing'}
            fits={fitLabels(tutor.id)}
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
        <TutorDetails tutor={selected} fits={fitLabels(selected.id)} voice={voice} />
      )}
    </fieldset>
  );
}

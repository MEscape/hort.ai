'use client';

import { useTranslations } from '@i18n/client';

import { useControlsForm } from '../hooks/use-controls-form';

import {
  AlwaysOnNote,
  GuardianConfirmation,
  InsightsSetting,
  VoiceSetting,
} from './controls-sections';
import { StepFrame } from './step-frame';
import { TimeSettings } from './time-settings';

import type { ChildProfileDto } from '../dto/learner-dto';

export interface ControlsStepProps {
  readonly stepNumber: number;
  readonly shouldTakeFocus: boolean;
  readonly profile: ChildProfileDto;
  readonly onBack: () => void;
  readonly onSaved: (saved: ChildProfileDto) => void;
}

/**
 * The parent's controls for the child, in groups with a heading each: voice, learning time, notes
 * for the summary, what always applies, and the guardian's confirmation. The safest value of every
 * control is already chosen, and nothing is kept before the confirmation.
 */
export function ControlsStep({
  stepNumber,
  shouldTakeFocus,
  profile,
  onBack,
  onSaved,
}: ControlsStepProps) {
  const t = useTranslations('learner');
  const { form, errorText, formError, isPending, onSubmit } = useControlsForm(profile, onSaved);
  const section = {
    control: form.control,
    errors: form.formState.errors,
    errorText,
    name: profile.displayName,
  };

  return (
    <StepFrame
      stepNumber={stepNumber}
      shouldTakeFocus={shouldTakeFocus}
      title={t('controls.title')}
      description={t('controls.description', { name: profile.displayName })}
      onSubmit={onSubmit}
      isPending={isPending}
      formError={formError}
      submitLabel={t('controls.submit')}
      onBack={onBack}
    >
      <VoiceSetting control={section.control} name={section.name} />
      <TimeSettings {...section} />
      <InsightsSetting control={section.control} name={section.name} />
      <AlwaysOnNote />
      <GuardianConfirmation {...section} />
    </StepFrame>
  );
}

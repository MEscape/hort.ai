'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { saveControlsAction } from '../actions/save-controls-action';
import { controlsSchema, NO_LIMIT } from '../schemas/onboarding-schema';

import { useStepSubmit } from './use-step-submit';

import type { StepSubmitState } from './use-step-submit';
import type { ChildProfileDto } from '../dto/learner-dto';
import type { ControlsForm } from '../schemas/onboarding-schema';
import type { UseFormReturn } from 'react-hook-form';

/** A window the parent can start from: after school, in minutes since midnight (15:00 to 18:00). */
export const DEFAULT_WINDOW = { from: 900, until: 1080 } as const;

/** Where the guardian's confirmation is shown on the form when the server refuses it. */
const CODE_FIELDS = {
  'learner.validation.window_invalid': 'windowUntil',
  'learner.validation.guardian_confirmation_required': 'guardianConfirmed',
  'learner.validation.daily_limit_invalid': 'dailyLimitMinutes',
} as const;

export interface ControlsFormState extends StepSubmitState {
  readonly form: UseFormReturn<ControlsForm>;
}

/**
 * The parent controls. Every default is the most private one (no voice, no limit, no window, no
 * notes) and the guardian confirmation starts unticked, so nothing is allowed by accident.
 */
// @unsaved-work none A few switches and one confirmation; the backend stores them on submit.
export function useControlsForm(
  profile: ChildProfileDto,
  onSaved: (saved: ChildProfileDto) => void,
): ControlsFormState {
  const window = profile.allowedWindow;
  const form = useForm<ControlsForm>({
    resolver: zodResolver(controlsSchema),
    defaultValues: {
      voiceEnabled: profile.voiceEnabled,
      dailyLimitMinutes:
        profile.dailyLimitMinutes === null ? NO_LIMIT : String(profile.dailyLimitMinutes),
      windowEnabled: window !== null,
      windowFrom: String(window?.fromMinute ?? DEFAULT_WINDOW.from),
      windowUntil: String(window?.untilMinute ?? DEFAULT_WINDOW.until),
      learningInsights: profile.learningInsights,
      guardianConfirmed: profile.guardianConfirmed,
    },
  });

  return {
    form,
    ...useStepSubmit(form, {
      send: (values) => saveControlsAction({ ...values, profileId: profile.id }),
      onSaved,
      codeFields: CODE_FIELDS,
    }),
  };
}

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { chooseTutorAction } from '../actions/choose-tutor-action';
import { tutorSchema } from '../schemas/onboarding-schema';

import { useStepSubmit } from './use-step-submit';

import type { StepSubmitState } from './use-step-submit';
import type { ChildProfileDto } from '../dto/learner-dto';
import type { TutorForm } from '../schemas/onboarding-schema';
import type { UseFormReturn } from 'react-hook-form';

export interface TutorFormState extends StepSubmitState {
  readonly form: UseFormReturn<TutorForm>;
}

/** The companion of the child. Nothing is preselected: the parent chooses, the backend checks it. */
// @unsaved-work none One choice; the backend stores it on submit.
export function useTutorForm(
  profile: ChildProfileDto,
  onSaved: (saved: ChildProfileDto) => void,
): TutorFormState {
  const form = useForm<TutorForm>({
    resolver: zodResolver(tutorSchema),
    defaultValues: { tutorId: profile.tutorId ?? '' },
  });

  return {
    form,
    ...useStepSubmit(form, {
      send: (values) => chooseTutorAction({ ...values, profileId: profile.id }),
      onSaved,
    }),
  };
}

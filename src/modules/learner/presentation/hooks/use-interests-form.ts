'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { saveInterestsAction } from '../actions/save-interests-action';
import { interestsSchema } from '../schemas/onboarding-schema';

import { useStepSubmit } from './use-step-submit';

import type { StepSubmitState } from './use-step-submit';
import type { ChildProfileDto } from '../dto/learner-dto';
import type { InterestsForm } from '../schemas/onboarding-schema';
import type { UseFormReturn } from 'react-hook-form';

export interface InterestsFormState extends StepSubmitState {
  readonly form: UseFormReturn<InterestsForm>;
}

/** The interests of the child: none to a few from a fixed list, so skipping is simply sending none. */
// @unsaved-work none A handful of chips; the backend stores them on submit.
export function useInterestsForm(
  profile: ChildProfileDto,
  onSaved: (saved: ChildProfileDto) => void,
): InterestsFormState {
  const form = useForm<InterestsForm>({
    resolver: zodResolver(interestsSchema),
    defaultValues: { interests: profile.interests as InterestsForm['interests'] },
  });

  return {
    form,
    ...useStepSubmit(form, {
      send: (values) => saveInterestsAction({ ...values, profileId: profile.id }),
      onSaved,
    }),
  };
}

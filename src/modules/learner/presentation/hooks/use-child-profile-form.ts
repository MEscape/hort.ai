'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { createChildProfileAction } from '../actions/create-child-profile-action';
import { childProfileSchema } from '../schemas/child-profile-schema';

import { useStepSubmit } from './use-step-submit';

import type { StepSubmitState } from './use-step-submit';
import type { ChildProfileDto } from '../dto/learner-dto';
import type { ChildProfileForm } from '../schemas/child-profile-schema';
import type { UseFormReturn } from 'react-hook-form';

export interface ChildProfileFormState extends StepSubmitState {
  readonly form: UseFormReturn<ChildProfileForm>;
}

/**
 * The child-profile form. It starts from the stored profile when the parent comes back to this
 * step, so a correction never means typing everything again; sending twice corrects the same
 * profile instead of adding another.
 */
// @unsaved-work none Three short fields; the backend stores the profile on submit.
export function useChildProfileForm(
  profile: ChildProfileDto | null,
  onSaved: (saved: ChildProfileDto) => void,
): ChildProfileFormState {
  const form = useForm<ChildProfileForm>({
    resolver: zodResolver(childProfileSchema),
    mode: 'onTouched',
    defaultValues: {
      displayName: profile?.displayName ?? '',
      federalState: (profile?.federalState ?? '') as ChildProfileForm['federalState'],
      grade: profile === null ? '' : String(profile.grade),
    },
  });

  return { form, ...useStepSubmit(form, { send: createChildProfileAction, onSaved }) };
}

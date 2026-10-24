'use client';

import { useForm } from 'react-hook-form';

import { completeSetupAction } from '../actions/complete-setup-action';

import { useStepSubmit } from './use-step-submit';

import type { StepSubmitState } from './use-step-submit';
import type { ChildProfileDto } from '../dto/learner-dto';

/**
 * Finishing the setup from the review screen. It has no fields of its own; it reuses the step
 * submit so a failed save keeps the parent here with the error and a way to send again.
 */
// @unsaved-work none Nothing to lose: the review screen only reads what the backend stored.
export function useCompleteSetup(
  profile: ChildProfileDto,
  onCompleted: (saved: ChildProfileDto) => void,
): StepSubmitState {
  const form = useForm<Record<string, never>>();
  return useStepSubmit(form, {
    send: () => completeSetupAction({ profileId: profile.id }),
    onSaved: onCompleted,
  });
}

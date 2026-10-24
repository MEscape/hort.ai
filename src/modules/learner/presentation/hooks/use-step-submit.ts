'use client';

import { useState, useTransition } from 'react';
import type { BaseSyntheticEvent } from 'react';

import { useRouter } from '@i18n';

import { applyActionError } from '@lib/actions';
import type { ActionResult } from '@lib/result';

import { LEARNER_ERROR_CODES } from '../../application/contracts/learner-constraints';
import { REQUEST_FAILED_CODE } from '../messages/message-keys';
import { learnerRoutes } from '../routes';

import { useLearnerErrorText } from './use-learner-error-text';

import type { ChildProfileDto } from '../dto/learner-dto';
import type { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';

export interface StepSubmitOptions<TValues extends FieldValues> {
  readonly send: (values: TValues) => Promise<ActionResult<ChildProfileDto>>;
  readonly onSaved: (saved: ChildProfileDto) => void;
  /** Routes a form-level error code to the field it belongs on. */
  readonly codeFields?: Readonly<Record<string, FieldPath<TValues>>>;
}

export interface StepSubmitState {
  readonly errorText: (code: string | undefined) => string | undefined;
  /** Why the whole step was refused (a failed save), above the button; `undefined` when fine. */
  readonly formError: string | undefined;
  readonly isPending: boolean;
  readonly onSubmit: (event?: BaseSyntheticEvent) => Promise<void>;
}

/**
 * What every onboarding step does when the parent presses its button: validate in the browser, send
 * to the server, and move on only after the server answered "saved". A refusal lands on the field it
 * is about with the input kept, a request that got no answer says so and can be sent again, and a
 * parent who is already set up is taken to the home. `isPending` blocks a second tap while saving.
 */
export function useStepSubmit<TValues extends FieldValues>(
  form: UseFormReturn<TValues>,
  { send, onSaved, codeFields = {} }: StepSubmitOptions<TValues>,
): StepSubmitState {
  const errorText = useLearnerErrorText();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);

  const onSubmit = form.handleSubmit((values) => {
    if (isPending) {
      return;
    }
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await send(values).catch(() => null);
      if (result === null) {
        setFormErrorCode(REQUEST_FAILED_CODE);
      } else if (result.ok) {
        onSaved(result.data);
      } else if (result.error.code === LEARNER_ERROR_CODES.alreadyOnboarded) {
        router.replace(learnerRoutes.home());
      } else {
        setFormErrorCode(applyActionError(result.error, form.setError, codeFields));
      }
    });
  });

  return { errorText, formError: errorText(formErrorCode ?? undefined), isPending, onSubmit };
}

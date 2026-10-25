'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useBeforeUnloadGuard } from '@hooks/use-before-unload-guard';

import { useRouter } from '@i18n';

import { updateParentControlsAction } from '../actions/update-parent-controls-action';
import { controlsSchema, NO_LIMIT } from '../schemas/onboarding-schema';

import { DEFAULT_WINDOW } from './use-controls-form';
import { useStepSubmit } from './use-step-submit';

import type { ChildProfileDto } from '../dto/learner-dto';
import type { ControlsForm } from '../schemas/onboarding-schema';

/** Drafts stay local until a confirmed save; failed requests retain edits and the persisted value. */
export function useParentControls(profile: ChildProfileDto) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const form = useForm<ControlsForm>({
    resolver: zodResolver(controlsSchema),
    defaultValues: {
      voiceEnabled: profile.voiceEnabled,
      guardianConfirmed: true,
      dailyLimitMinutes:
        profile.dailyLimitMinutes === null ? NO_LIMIT : String(profile.dailyLimitMinutes),
      windowEnabled: profile.allowedWindow !== null,
      windowFrom: String(profile.allowedWindow?.fromMinute ?? DEFAULT_WINDOW.from),
      windowUntil: String(profile.allowedWindow?.untilMinute ?? DEFAULT_WINDOW.until),
      learningInsights: profile.learningInsights,
    },
  });
  useBeforeUnloadGuard(form.formState.isDirty);
  const submit = useStepSubmit(form, {
    send: (values) =>
      updateParentControlsAction({
        profileId: profile.id,
        dailyLimitMinutes: values.dailyLimitMinutes,
        windowEnabled: values.windowEnabled,
        windowFrom: values.windowFrom,
        windowUntil: values.windowUntil,
        learningInsights: values.learningInsights,
      }),
    onSaved: () => {
      form.reset(form.getValues());
      setSaved(true);
      router.refresh();
    },
    codeFields: {
      'learner.validation.window_invalid': 'windowUntil',
      'learner.validation.daily_limit_invalid': 'dailyLimitMinutes',
    },
  });
  return {
    ...submit,
    form,
    saved: saved && !form.formState.isDirty && !submit.isPending && submit.formError === undefined,
  };
}

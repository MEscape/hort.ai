'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { createClassroomAction } from '../actions/create-classroom-action';
import { messageKeyForCode } from '../messages/message-keys';
import { newClassroomSchema } from '../schemas/classroom-schema';

import type { z } from 'zod';

type NewClassroom = z.infer<typeof newClassroomSchema>;

/** The MVP slice (#5): Hessen, mathematics. The grade is the teacher's choice. */
const MVP_DEFAULTS: NewClassroom = { name: '', federalState: 'he', grade: 3, subject: 'math' };

/**
 * Creates a class and keeps its invite code on screen: the code is returned this once and only
 * its hash is stored, so the teacher must see it before moving on.
 */
// @unsaved-work none Two short fields that are quickly typed again; nothing is lost by leaving.
export function useCreateClassroomForm() {
  const t = useTranslations('classroom');
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const form = useForm<NewClassroom>({
    resolver: zodResolver(newClassroomSchema),
    defaultValues: MVP_DEFAULTS,
    mode: 'onTouched',
    shouldFocusError: true,
  });

  const onSubmit = form.handleSubmit((values) => {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await createClassroomAction(values);
      if (result.ok) {
        setInviteCode(result.data.inviteCode);
        return;
      }
      setFormErrorCode(applyActionError(result.error, form.setError));
    });
  });

  return {
    form,
    isPending,
    inviteCode,
    onSubmit,
    formError: formErrorCode === null ? undefined : t(messageKeyForCode(formErrorCode)),
    errorText: (code: string | undefined) =>
      code === undefined ? undefined : t(messageKeyForCode(code)),
  };
}

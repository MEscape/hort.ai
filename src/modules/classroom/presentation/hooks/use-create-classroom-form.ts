'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { createClassroomAction } from '../actions/create-classroom-action';
import { messageKeyForCode } from '../messages/message-keys';
import { newClassroomSchema } from '../schemas/classroom-schema';

import { useAnnounceClassroomCreated } from './use-announce-classroom-created';

import type { z } from 'zod';

type NewClassroom = z.infer<typeof newClassroomSchema>;

/** The MVP slice (#5): Hessen, mathematics. The grade is the teacher's choice. */
const MVP_DEFAULTS: NewClassroom = { name: '', federalState: 'he', grade: 3, subject: 'math' };

/**
 * Creates a class. The invite code goes to the success dialog of `ClassroomCreationProvider`, not
 * into this form's state: the page shows the new class right after (refresh), which may unmount the
 * form, and the code must stay on screen until the teacher closes the dialog.
 */
// @unsaved-work none Two short fields that are quickly typed again; nothing is lost by leaving.
export function useCreateClassroomForm(onCreated?: () => void) {
  const t = useTranslations('classroom');
  const router = useRouter();
  const announce = useAnnounceClassroomCreated();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
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
      if (!result.ok) {
        setFormErrorCode(applyActionError(result.error, form.setError));
        return;
      }
      const { classroom, inviteCode } = result.data;
      announce({ name: classroom.name, grade: classroom.grade, inviteCode });
      form.reset(MVP_DEFAULTS);
      onCreated?.();
      router.refresh();
    });
  });

  return {
    form,
    isPending,
    onSubmit,
    formError: formErrorCode === null ? undefined : t(messageKeyForCode(formErrorCode)),
    errorText: (code: string | undefined) =>
      code === undefined ? undefined : t(messageKeyForCode(code)),
  };
}

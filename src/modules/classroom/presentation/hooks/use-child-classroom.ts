'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { CLASSROOM_ERROR_CODES } from '../../application/contracts/classroom-constraints';
import { joinClassroomAction } from '../actions/join-classroom-action';
import { leaveClassroomAction } from '../actions/leave-classroom-action';
import { messageKeyForCode } from '../messages/message-keys';
import { joinClassroomSchema } from '../schemas/classroom-schema';

import type { z } from 'zod';

type JoinClassroom = z.infer<typeof joinClassroomSchema>;

/**
 * Joining a class with the teacher's code, and leaving it after a confirmation. The child id comes
 * from the server-rendered page; the actions authorize the parent on the stored profile again.
 * After a change the page is refreshed, so the shown class always comes from the server.
 */
// @unsaved-work none One short code that the parent copies again from the teacher's note.
export function useChildClassroom(childProfileId: string) {
  const t = useTranslations('classroom');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [isConfirmingLeave, setIsConfirmingLeave] = useState(false);
  const form = useForm<JoinClassroom>({
    resolver: zodResolver(joinClassroomSchema),
    defaultValues: { childProfileId, inviteCode: '' },
    mode: 'onSubmit',
    shouldFocusError: true,
  });

  const onJoin = form.handleSubmit((values) => {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await joinClassroomAction(values);
      if (result.ok) {
        form.reset({ childProfileId, inviteCode: '' });
        router.refresh();
        return;
      }
      setFormErrorCode(
        applyActionError(result.error, form.setError, {
          [CLASSROOM_ERROR_CODES.inviteCodeInvalid]: 'inviteCode',
        }),
      );
    });
  });

  function confirmLeave() {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await leaveClassroomAction({ childProfileId });
      if (result.ok) {
        setIsConfirmingLeave(false);
        router.refresh();
        return;
      }
      setFormErrorCode(result.error.code);
    });
  }

  return {
    form,
    isPending,
    isConfirmingLeave,
    onJoin,
    confirmLeave,
    requestLeave: () => {
      setIsConfirmingLeave(true);
    },
    cancelLeave: () => {
      setIsConfirmingLeave(false);
    },
    formError: formErrorCode === null ? undefined : t(messageKeyForCode(formErrorCode)),
    errorText: (code: string | undefined) =>
      code === undefined ? undefined : t(messageKeyForCode(code)),
  };
}

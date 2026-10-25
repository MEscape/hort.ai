'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { useRouter } from '@i18n';

import { applyActionError } from '@lib/actions';

import { updateDisplayNameAction } from '../actions/update-display-name-action';
import { displayNameSchema } from '../schemas/account-schema';

import { useAuthErrorText } from './use-auth-error-text';

import type { DisplayNameForm } from '../schemas/account-schema';

/** Renames the signed-in person; the header shows the new name after the refresh. */
// @unsaved-work none One short field, typed again in seconds; nothing else on the page is lost.
export function useDisplayNameForm(currentName: string) {
  const errorText = useAuthErrorText();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSaved, setIsSaved] = useState(false);
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const form = useForm<DisplayNameForm>({
    resolver: zodResolver(displayNameSchema),
    defaultValues: { name: currentName },
    mode: 'onTouched',
  });

  const onSubmit = form.handleSubmit((values) => {
    setIsSaved(false);
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await updateDisplayNameAction(values);
      if (result.ok) {
        form.reset(values);
        setIsSaved(true);
        router.refresh();
        return;
      }
      setFormErrorCode(applyActionError(result.error, form.setError));
    });
  });

  return {
    form,
    isPending,
    isSaved,
    errorText,
    formError: errorText(formErrorCode ?? undefined),
    onSubmit,
  };
}

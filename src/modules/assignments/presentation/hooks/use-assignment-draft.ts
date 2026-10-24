'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFormState } from 'react-hook-form';

import { useTranslations } from '@i18n/client';

import { toChildAssignmentView } from '../dto/child-assignment-dto';
import { assignmentDraftSchema } from '../schemas/assignment-draft-schema';

import { useBeforeUnloadGuard } from './use-before-unload-guard';

import type { ChildAssignmentView } from '../dto/child-assignment-dto';
import type { AssignmentDraft } from '../schemas/assignment-draft-schema';

const EMPTY_DRAFT: AssignmentDraft = { title: '', taskText: '', dueDate: '', solutionKey: '' };

/** One in-memory draft, validation and safe preview. No requests, storage or saved-state simulation. */
export function useAssignmentDraft() {
  const t = useTranslations('assignments');
  const [view, setView] = useState<'overview' | 'edit' | 'preview'>('overview');
  const [preview, setPreview] = useState<ChildAssignmentView | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const form = useForm<AssignmentDraft>({
    resolver: zodResolver(assignmentDraftSchema),
    defaultValues: EMPTY_DRAFT,
    mode: 'onTouched',
    shouldFocusError: true,
  });
  const { isDirty } = useFormState({ control: form.control });
  useBeforeUnloadGuard(isDirty);

  const onPreview = form.handleSubmit((values) => {
    setPreview(toChildAssignmentView(values));
    setView('preview');
  });

  function requestOverview() {
    if (isDirty) {
      setIsDiscarding(true);
    } else {
      setView('overview');
    }
  }

  function discardDraft() {
    form.reset(EMPTY_DRAFT);
    setPreview(null);
    setIsDiscarding(false);
    setView('overview');
  }

  function errorText(code: string | undefined): string | undefined {
    switch (code) {
      case 'titleRequired':
        return t('validation.titleRequired');
      case 'titleTooLong':
        return t('validation.titleTooLong');
      case 'taskRequired':
        return t('validation.taskRequired');
      case 'taskTooLong':
        return t('validation.taskTooLong');
      case 'dateInvalid':
        return t('validation.dateInvalid');
      case 'solutionTooLong':
        return t('validation.solutionTooLong');
      default:
        return undefined;
    }
  }

  return {
    form,
    view,
    preview,
    isDiscarding,
    onPreview,
    errorText,
    openEditor: () => {
      setView('edit');
    },
    requestOverview,
    discardDraft,
    keepDraft: () => {
      setIsDiscarding(false);
    },
  };
}

export type AssignmentDraftState = ReturnType<typeof useAssignmentDraft>;

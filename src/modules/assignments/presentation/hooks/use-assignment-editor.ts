'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFormState } from 'react-hook-form';

import { useBeforeUnloadGuard } from '@hooks/use-before-unload-guard';

import { applyActionError } from '@lib/actions';

import { createAssignmentAction } from '../actions/create-assignment-action';
import { updateAssignmentAction } from '../actions/update-assignment-action';
import { toChildAssignmentContent } from '../dto/child-assignment-dto';
import { assignmentDraftSchema } from '../schemas/assignment-draft-schema';

import type { TeacherAssignmentView } from '../../application/contracts/assignment-views';
import type { ChildAssignmentContent } from '../dto/child-assignment-dto';
import type { AssignmentDraft } from '../schemas/assignment-draft-schema';

const EMPTY_DRAFT: AssignmentDraft = { title: '', taskText: '', dueDate: '', solutionKey: '' };

type EditorView = 'overview' | 'edit' | 'preview';

function toDraft(assignment: TeacherAssignmentView): AssignmentDraft {
  return {
    title: assignment.title,
    taskText: assignment.taskText,
    dueDate: assignment.dueDate ?? '',
    solutionKey: assignment.solutionKey ?? '',
  };
}

interface AssignmentEditorOptions {
  readonly classroomId: string;
  readonly onSaved: () => void;
}

/**
 * One draft (a new assignment or a copy of a saved one), its child preview and saving. Unsaved
 * changes are guarded on reload and need confirmation before leaving the editor. A failed save
 * keeps the input and puts the server's codes on their fields.
 */
export function useAssignmentEditor({ classroomId, onSaved }: AssignmentEditorOptions) {
  const [view, setView] = useState<EditorView>('overview');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ChildAssignmentContent | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const form = useForm<AssignmentDraft>({
    resolver: zodResolver(assignmentDraftSchema),
    defaultValues: EMPTY_DRAFT,
    mode: 'onTouched',
    shouldFocusError: true,
  });
  const { isDirty } = useFormState({ control: form.control });
  useBeforeUnloadGuard(isDirty);

  function open(id: string | null, values: AssignmentDraft) {
    form.reset(values);
    setEditingId(id);
    setPreview(null);
    setFormErrorCode(null);
    setView('edit');
  }

  function close() {
    form.reset(EMPTY_DRAFT);
    setEditingId(null);
    setPreview(null);
    setIsDiscarding(false);
    setView('overview');
  }

  const onPreview = form.handleSubmit((values) => {
    setPreview(toChildAssignmentContent(values));
    setView('preview');
  });

  const onSave = form.handleSubmit((values) => {
    setFormErrorCode(null);
    startSaving(async () => {
      const result =
        editingId === null
          ? await createAssignmentAction({ ...values, classroomId })
          : await updateAssignmentAction({ ...values, id: editingId });
      if (result.ok) {
        close();
        onSaved();
        return;
      }
      setView('edit');
      setFormErrorCode(applyActionError(result.error, form.setError));
    });
  });

  return {
    form,
    view,
    isEditing: editingId !== null,
    preview,
    isDiscarding,
    isSaving,
    formErrorCode,
    onPreview,
    onSave,
    openNew: () => {
      open(null, EMPTY_DRAFT);
    },
    openEdit: (assignment: TeacherAssignmentView) => {
      open(assignment.id, toDraft(assignment));
    },
    returnToEditor: () => {
      setView('edit');
    },
    requestOverview: () => {
      if (isDirty) {
        setIsDiscarding(true);
      } else {
        close();
      }
    },
    discardDraft: close,
    keepDraft: () => {
      setIsDiscarding(false);
    },
  };
}

export type AssignmentEditorState = ReturnType<typeof useAssignmentEditor>;

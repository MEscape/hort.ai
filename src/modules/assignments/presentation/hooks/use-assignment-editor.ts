'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFormState, useWatch } from 'react-hook-form';

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

interface StoredDraft {
  readonly id: string | null;
  readonly baseline: AssignmentDraft;
  readonly values: AssignmentDraft;
}

const DRAFT_FIELDS = ['title', 'taskText', 'dueDate', 'solutionKey'] as const;

function isDraft(value: unknown): value is AssignmentDraft {
  return (
    typeof value === 'object' &&
    value !== null &&
    DRAFT_FIELDS.every((field) => typeof (value as Record<string, unknown>)[field] === 'string')
  );
}

/**
 * Browser back/forward to another class replaces the editor without any click to intercept, so an
 * unsaved draft is kept per class in this tab's session storage and restored when the class opens
 * again. It is removed on save and discard; the storage dies with the tab.
 */
function draftStore(classroomId: string) {
  const key = `hortai:assignment-draft:${classroomId}`;
  return {
    read(): StoredDraft | null {
      try {
        const parsed: unknown = JSON.parse(window.sessionStorage.getItem(key) ?? 'null');
        if (typeof parsed !== 'object' || parsed === null) {
          return null;
        }
        const { id, baseline, values } = parsed as Record<string, unknown>;
        return (typeof id === 'string' || id === null) && isDraft(baseline) && isDraft(values)
          ? { id, baseline, values }
          : null;
      } catch {
        return null;
      }
    },
    write(draft: StoredDraft) {
      try {
        window.sessionStorage.setItem(key, JSON.stringify(draft));
      } catch {
        // Storage full or blocked: the click guard and the unload guard still apply.
      }
    },
    clear() {
      try {
        window.sessionStorage.removeItem(key);
      } catch {
        // Nothing stored then.
      }
    },
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
  const watchedValues = useWatch({ control: form.control });
  const baseline = useRef<AssignmentDraft>(EMPTY_DRAFT);
  const [store] = useState(() => draftStore(classroomId));

  useEffect(() => {
    const stored = store.read();
    if (stored === null) {
      return;
    }
    baseline.current = stored.baseline;
    form.reset(stored.baseline);
    setEditingId(stored.id);
    setView('edit');
    for (const field of DRAFT_FIELDS) {
      form.setValue(field, stored.values[field], { shouldDirty: true });
    }
  }, [store, form]);

  useEffect(() => {
    if (view === 'overview') {
      return;
    }
    if (isDirty && isDraft(watchedValues)) {
      store.write({ id: editingId, baseline: baseline.current, values: watchedValues });
    } else if (!isDirty) {
      // Reverting every field to the baseline must not resurrect an older stored draft.
      store.clear();
    }
  }, [store, view, isDirty, watchedValues, editingId]);

  function open(id: string | null, values: AssignmentDraft) {
    baseline.current = values;
    form.reset(values);
    setEditingId(id);
    setPreview(null);
    setFormErrorCode(null);
    setView('edit');
  }

  function close() {
    store.clear();
    baseline.current = EMPTY_DRAFT;
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
    hasUnsavedChanges: isDirty,
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

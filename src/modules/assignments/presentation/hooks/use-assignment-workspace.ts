'use client';

import { useState } from 'react';

import { useTranslations } from '@i18n/client';

import { messageKeyForCode } from '../messages/message-keys';

import { useAssignmentDeletion } from './use-assignment-deletion';
import { useAssignmentEditor } from './use-assignment-editor';

import type { TeacherAssignmentView } from '../../application/contracts/assignment-views';

type Notice = 'saved' | 'deleted';

/**
 * The teacher's screen for one class: the editor, deletion and a status line announcing what was
 * just saved or deleted. The list itself comes from the server and is refreshed by the actions.
 */
export function useAssignmentWorkspace(classroomId: string) {
  const t = useTranslations('assignments');
  const [notice, setNotice] = useState<Notice | null>(null);
  const editor = useAssignmentEditor({
    classroomId,
    onSaved: () => {
      setNotice('saved');
    },
  });
  const deletion = useAssignmentDeletion(() => {
    setNotice('deleted');
  });

  return {
    editor,
    deletion,
    noticeText: notice === null ? null : t(notice === 'saved' ? 'status.saved' : 'status.deleted'),
    errorText: (code: string | null | undefined): string | undefined =>
      code === null || code === undefined ? undefined : t(messageKeyForCode(code)),
    openNew: () => {
      setNotice(null);
      editor.openNew();
    },
    openEdit: (assignment: TeacherAssignmentView) => {
      setNotice(null);
      editor.openEdit(assignment);
    },
  };
}

export type AssignmentWorkspaceState = ReturnType<typeof useAssignmentWorkspace>;

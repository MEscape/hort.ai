'use client';

import type { ReactNode } from 'react';

import { useTranslations } from '@i18n/client';

import { useAssignmentWorkspace } from '../hooks/use-assignment-workspace';
import { useClassroomSwitch } from '../hooks/use-classroom-switch';

import { AssignmentForm } from './assignment-form';
import { AssignmentOverview } from './assignment-overview';
import { AssignmentPreviewPanel } from './assignment-preview-panel';
import { ClassroomPicker } from './classroom-picker';
import { ConfirmPrompt } from './confirm-prompt';

import type {
  TeacherAssignmentView,
  TeacherClassroomView,
} from '../../application/contracts/assignment-views';

interface TeacherAssignmentWorkspaceProps {
  /** The teacher's active classes; switching asks first while a draft has unsaved changes. */
  readonly classrooms: readonly TeacherClassroomView[];
  readonly classroomId: string;
  readonly classroomName: string;
  /** Loaded by the page for the signed-in teacher; refreshed by the actions after each change. */
  readonly assignments: readonly TeacherAssignmentView[];
  /** Rendered beside the class selector (the classroom module's "Add class"). */
  readonly classroomActions?: ReactNode;
}

/** One class's assignments: list, create, edit with child preview, and confirmed deletion. */
export function TeacherAssignmentWorkspace({
  classrooms,
  classroomId,
  classroomName,
  assignments,
  classroomActions,
}: TeacherAssignmentWorkspaceProps) {
  const t = useTranslations('assignments');
  const state = useAssignmentWorkspace(classroomId);
  const { editor } = state;
  const classroomSwitch = useClassroomSwitch(editor);

  return (
    <div className="space-y-4">
      <ClassroomPicker
        classrooms={classrooms}
        selectedClassroomId={classroomId}
        onSelect={classroomSwitch.requestSwitch}
        isBlocked={classroomSwitch.isBlocked}
        actions={classroomActions}
      />
      {classroomSwitch.pendingHref !== null && (
        <ConfirmPrompt
          title={t('switch.title')}
          body={t('switch.body')}
          keepLabel={t('switch.keep')}
          confirmLabel={t('switch.confirm')}
          onKeep={classroomSwitch.keepEditing}
          onConfirm={classroomSwitch.discardAndSwitch}
        />
      )}
      <p role="status" className="font-semibold text-primary-copy empty:sr-only">
        {state.noticeText}
      </p>
      {editor.view === 'overview' && (
        <AssignmentOverview classroomName={classroomName} assignments={assignments} state={state} />
      )}
      {editor.view === 'edit' && <AssignmentForm state={state} />}
      {editor.view === 'preview' && editor.preview !== null && (
        <AssignmentPreviewPanel assignment={editor.preview} editor={editor} />
      )}
      {editor.isDiscarding && (
        <ConfirmPrompt
          title={t('discard.title')}
          body={t('discard.body')}
          keepLabel={t('discard.keep')}
          confirmLabel={t('discard.confirm')}
          onKeep={editor.keepDraft}
          onConfirm={editor.discardDraft}
        />
      )}
    </div>
  );
}

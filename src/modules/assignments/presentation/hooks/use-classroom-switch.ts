'use client';

import { useState } from 'react';
import type { MouseEvent } from 'react';

import { useRouter } from '@i18n';

import type { AssignmentEditorState } from './use-assignment-editor';

/**
 * Switching to another class replaces the editor (the page keys it by class), and a client-side
 * navigation does not trigger the browser's unload guard. So with unsaved changes the switch waits
 * for the teacher: keep editing, or discard and switch. While a save runs, switching is blocked.
 */
export function useClassroomSwitch(editor: AssignmentEditorState) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  return {
    pendingHref,
    isBlocked: editor.isSaving,
    requestSwitch: (event: MouseEvent<HTMLAnchorElement>, href: string) => {
      if (editor.isSaving) {
        event.preventDefault();
        return;
      }
      if (editor.hasUnsavedChanges) {
        event.preventDefault();
        setPendingHref(href);
      }
    },
    keepEditing: () => {
      setPendingHref(null);
    },
    discardAndSwitch: () => {
      if (pendingHref === null) {
        return;
      }
      editor.discardDraft();
      setPendingHref(null);
      router.push(pendingHref);
    },
  };
}

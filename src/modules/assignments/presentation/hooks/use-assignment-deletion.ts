'use client';

import { useState, useTransition } from 'react';

import { deleteAssignmentAction } from '../actions/delete-assignment-action';

import type { TeacherAssignmentView } from '../../application/contracts/assignment-views';

/** Deleting asks first; the assignment stays until the teacher confirms and the server agrees. */
export function useAssignmentDeletion(onDeleted: () => void) {
  const [target, setTarget] = useState<TeacherAssignmentView | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  function confirm() {
    if (target === null) {
      return;
    }
    const { id } = target;
    setErrorCode(null);
    startDeleting(async () => {
      const result = await deleteAssignmentAction({ id });
      if (result.ok) {
        setTarget(null);
        onDeleted();
      } else {
        setErrorCode(result.error.code);
      }
    });
  }

  return {
    target,
    errorCode,
    isDeleting,
    request: (assignment: TeacherAssignmentView) => {
      setErrorCode(null);
      setTarget(assignment);
    },
    cancel: () => {
      setErrorCode(null);
      setTarget(null);
    },
    confirm,
  };
}

'use client';

import { createContext, useContext } from 'react';

/** What the success dialog shows: the code is returned once by the server and kept only here. */
export interface CreatedClassroom {
  readonly name: string;
  readonly grade: number;
  readonly inviteCode: string;
}

export const ClassroomCreatedContext = createContext<((created: CreatedClassroom) => void) | null>(
  null,
);

/**
 * Hands a just-created class to the success dialog, which lives above the part of the page that
 * changes once the class exists. A form that unmounts right after creating therefore cannot take
 * the only copy of the invite code with it.
 */
export function useAnnounceClassroomCreated(): (created: CreatedClassroom) => void {
  const announce = useContext(ClassroomCreatedContext);
  if (announce === null) {
    throw new Error('A classroom form must be rendered inside ClassroomCreationProvider.');
  }
  return announce;
}

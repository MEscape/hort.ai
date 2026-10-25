'use client';

import { useState } from 'react';

type CopyState = 'idle' | 'copied' | 'failed';

/** How the last attempt went, and for which text: a different text starts from `idle` again. */
interface Attempt {
  readonly text: string;
  readonly state: CopyState;
}

/**
 * Copies a text to the clipboard and remembers how that went, for a status line. Copying can be
 * refused (no permission, an insecure origin); then the code stays readable on screen. The status
 * belongs to the text that was copied: when the text changes (a replaced code) it is not shown for
 * the new one.
 */
export function useCopyText(text: string) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const state: CopyState = attempt?.text === text ? attempt.state : 'idle';

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setAttempt({ text, state: 'copied' });
    } catch {
      setAttempt({ text, state: 'failed' });
    }
  }

  return {
    state,
    copy: () => {
      void copy();
    },
  };
}

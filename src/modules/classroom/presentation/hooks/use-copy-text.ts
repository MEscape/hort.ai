'use client';

import { useState } from 'react';

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * Copies a text to the clipboard and remembers how that went, for a status line. Copying can be
 * refused (no permission, an insecure origin); then the code stays readable on screen.
 */
export function useCopyText(text: string) {
  const [state, setState] = useState<CopyState>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
  }

  return {
    state,
    copy: () => {
      void copy();
    },
  };
}

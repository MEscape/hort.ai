'use client';

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * Moves keyboard and screen-reader focus to an element when it appears, for the moment a form is
 * replaced by its answer ("Check your inbox!"): the form that had focus is gone, so without this
 * focus falls back to the top of the page. The element needs `tabIndex={-1}` to be focusable.
 */
export function useFocusOnMount<T extends HTMLElement>(isEnabled: boolean): RefObject<T | null> {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (isEnabled) {
      ref.current?.focus();
    }
  }, [isEnabled]);

  return ref;
}

'use client';

import { useSyncExternalStore } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-motion'],
  });
  return () => {
    query.removeEventListener('change', onChange);
    observer.disconnect();
  };
}

/** Reduced motion from the operating system or from the in-app calm setting on `<html>`. */
function isCalmNow(): boolean {
  return (
    window.matchMedia(REDUCED_MOTION).matches ||
    document.documentElement.dataset['motion'] === 'calm'
  );
}

/**
 * True when the child or parent wants no motion (`prefers-reduced-motion` or `data-motion="calm"`
 * on `<html>`). CSS already stops every animation then; use this where a component should leave
 * the motion out altogether (no hop, no bob) or show a different, still state instead.
 */
export function useCalmMotion(): boolean {
  return useSyncExternalStore(subscribe, isCalmNow, () => false);
}

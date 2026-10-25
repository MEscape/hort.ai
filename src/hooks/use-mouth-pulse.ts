'use client';

import { useEffect, useState } from 'react';

import { useCalmMotion } from './use-calm-motion';

/**
 * Whether a mouth that chews is open right now: it alternates between open and shut at a steady,
 * unhurried rhythm while `isActive`. With reduced motion it stays shut (a still, content face), so
 * nothing flickers. Re-renders only the component that calls it.
 */
export function useMouthPulse(isActive: boolean, openMs: number, shutMs: number): boolean {
  const [isOpen, setIsOpen] = useState(false);
  const isCalm = useCalmMotion();

  useEffect(() => {
    if (!isActive || isCalm) {
      return undefined;
    }
    let open = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const next = () => {
      setIsOpen(open);
      timer = setTimeout(next, open ? openMs : shutMs);
      open = !open;
    };
    next();
    return () => {
      clearTimeout(timer);
      setIsOpen(false);
    };
  }, [isActive, isCalm, openMs, shutMs]);

  return isActive && !isCalm && isOpen;
}

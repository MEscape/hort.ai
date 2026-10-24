'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

export type TutorIntroStatus = 'idle' | 'playing' | 'unavailable';

export interface TutorIntro {
  readonly status: TutorIntroStatus;
  /** True once the introduction was started: only then is the open-mouth picture worth loading. */
  readonly hasStarted: boolean;
  /** The mouth of the picture right now: it moves while the companion speaks. */
  readonly isMouthOpen: boolean;
  /** Plays the introduction from the start, or stops it when it is playing. */
  readonly toggle: () => void;
}

const FLAP_MS = 150;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeToMotionPreference(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

/**
 * The spoken introduction of one companion: a plain `<audio>` file from public storage, so no
 * speech provider is involved. It plays only after the parent presses the button (browsers
 * require that anyway), stops when the screen is left or another companion is shown (the stage is
 * keyed by companion), and says so when the file cannot be played. While it plays the mouth
 * alternates every 150 ms; with reduced motion it simply stays open.
 */
export function useTutorIntro(introUrl: string): TutorIntro {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<TutorIntroStatus>('idle');
  const [hasStarted, setHasStarted] = useState(false);
  const [isFlapped, setIsFlapped] = useState(false);
  const isCalm = useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    [],
  );

  useEffect(() => {
    if (status !== 'playing' || isCalm) {
      return undefined;
    }
    const timer = setInterval(() => {
      setIsFlapped((open) => !open);
    }, FLAP_MS);
    return () => {
      clearInterval(timer);
    };
  }, [status, isCalm]);

  const toggle = () => {
    const current = audioRef.current;
    if (status === 'playing' && current !== null) {
      current.pause();
      current.currentTime = 0;
      setStatus('idle');
      return;
    }
    const element = current ?? new Audio(introUrl);
    audioRef.current = element;
    element.onended = () => {
      setStatus('idle');
    };
    element.onerror = () => {
      setStatus('unavailable');
    };
    element.currentTime = 0;
    setHasStarted(true);
    setStatus('playing');
    element.play().catch(() => {
      setStatus('unavailable');
    });
  };

  return {
    status,
    hasStarted,
    isMouthOpen: status === 'playing' && (isCalm || isFlapped),
    toggle,
  };
}

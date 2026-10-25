'use client';

import { useEffect, useRef, useState } from 'react';

export type CharacterVoiceStatus = 'idle' | 'playing' | 'unavailable';

export interface CharacterVoice {
  /** `unavailable` is an empty address or a sound that failed (a new press tries again). */
  readonly status: CharacterVoiceStatus;
  /** Plays the audio from the start, or stops it while it plays. */
  readonly toggle: () => void;
  /** Stops it without starting again, for a tap somewhere else. */
  readonly stop: () => void;
  /** How far the sound is, 0 to 1; only moves with `trackProgress`, otherwise always 0. */
  readonly progress: number;
  /** True from the press until the sound really runs (and whenever the browser waits for data). */
  readonly isBuffering: boolean;
}

export interface CharacterVoiceOptions {
  /** Report `progress`. Off by default so a screen re-renders only when playing starts or stops. */
  readonly trackProgress?: boolean;
}

interface Playback {
  /** The address this status belongs to: a status from another address is not this audio's. */
  readonly url: string;
  readonly status: CharacterVoiceStatus;
  readonly progress: number;
  readonly isBuffering: boolean;
}

const PROGRESS_STEPS = 100;

const idle = (url: string): Playback => ({ url, status: 'idle', progress: 0, isBuffering: false });

/** The fraction played, in whole percent so a re-render happens a hundred times at most. */
function fractionOf(element: HTMLAudioElement): number {
  const { currentTime, duration } = element;
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0;
  }
  return Math.min(1, Math.round((currentTime / duration) * PROGRESS_STEPS) / PROGRESS_STEPS);
}

function silence(element: HTMLAudioElement): void {
  Object.assign(element, {
    onended: null,
    onerror: null,
    onplaying: null,
    onwaiting: null,
    ontimeupdate: null,
  });
  element.pause();
}

/**
 * Plays one audio file (a character's stored introduction) as a plain `<audio>`, only after a press
 * (browsers need that anyway). Another address starts from "idle" without any effect, because the
 * status remembers which address it belongs to, and the sound of the old one stops. Leaving the
 * screen stops it. An empty address is "unavailable"; so is a sound that failed, and a new press
 * then starts over with a fresh element. Which mouth to show is the character's job
 * (`useLipSync`), so a re-render here happens only when playing starts or stops (plus the progress
 * when asked for).
 */
export function useCharacterVoice(
  url: string,
  { trackProgress = false }: CharacterVoiceOptions = {},
): CharacterVoice {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef(url);
  const [playback, setPlayback] = useState<Playback>(idle(url));

  useEffect(() => {
    if (urlRef.current !== url) {
      if (audioRef.current !== null) {
        silence(audioRef.current);
      }
      audioRef.current = null;
      urlRef.current = url;
    }
  }, [url]);

  useEffect(
    () => () => {
      if (audioRef.current !== null) {
        silence(audioRef.current);
      }
    },
    [],
  );

  const known = playback.url === url ? playback : idle(url);
  const status: CharacterVoiceStatus = url === '' ? 'unavailable' : known.status;

  const stop = () => {
    const current = audioRef.current;
    if (current !== null) {
      current.pause();
      current.currentTime = 0;
    }
    setPlayback(idle(url));
  };

  const fail = (element: HTMLAudioElement) => {
    if (audioRef.current === element) {
      audioRef.current = null;
    }
    setPlayback({ ...idle(url), status: 'unavailable' });
  };

  const toggle = () => {
    if (url === '') {
      return;
    }
    if (status === 'playing') {
      stop();
      return;
    }
    const element = audioRef.current ?? new Audio(url);
    audioRef.current = element;
    element.onended = () => {
      setPlayback(idle(url));
    };
    element.onerror = () => {
      fail(element);
    };
    element.onplaying = () => {
      setPlayback((now) => ({ ...now, isBuffering: false }));
    };
    element.onwaiting = () => {
      setPlayback((now) => ({ ...now, isBuffering: true }));
    };
    if (trackProgress) {
      element.ontimeupdate = () => {
        const progress = fractionOf(element);
        setPlayback((now) => (now.progress === progress ? now : { ...now, progress }));
      };
    }
    element.currentTime = 0;
    setPlayback({ url, status: 'playing', progress: 0, isBuffering: true });
    element.play().catch((error: unknown) => {
      // Stopping while the sound still loads rejects the promise with an AbortError: not a failure.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        fail(element);
      }
    });
  };

  return { status, toggle, stop, progress: known.progress, isBuffering: known.isBuffering };
}

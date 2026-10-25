'use client';

import { useEffect, useRef, useState } from 'react';

export type CharacterVoiceStatus = 'idle' | 'playing' | 'unavailable';

export interface CharacterVoice {
  readonly status: CharacterVoiceStatus;
  /** Plays the audio from the start, or stops it while it plays. */
  readonly toggle: () => void;
  /** Stops it without starting again, for a tap somewhere else. */
  readonly stop: () => void;
}

interface Playback {
  /** The address this status belongs to: a status from another address is not this audio's. */
  readonly url: string;
  readonly status: CharacterVoiceStatus;
}

/**
 * Plays one audio file (a character's stored introduction) as a plain `<audio>`, only after a press
 * (browsers need that anyway). Another address starts from "idle" without any effect, because the
 * status remembers which address it belongs to, and the sound of the old one stops. Leaving the
 * screen stops it. An empty address is "unavailable". Which mouth to show is the character's job
 * (`useLipSync`), so a re-render here happens only when playing starts or stops.
 */
export function useCharacterVoice(url: string): CharacterVoice {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef(url);
  const [playback, setPlayback] = useState<Playback>({ url, status: 'idle' });

  useEffect(() => {
    if (urlRef.current !== url) {
      audioRef.current?.pause();
      audioRef.current = null;
      urlRef.current = url;
    }
  }, [url]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    [],
  );

  const known = playback.url === url ? playback.status : 'idle';
  const status: CharacterVoiceStatus = url === '' ? 'unavailable' : known;

  const stop = () => {
    const current = audioRef.current;
    if (current !== null) {
      current.pause();
      current.currentTime = 0;
    }
    setPlayback({ url, status: 'idle' });
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
      setPlayback({ url, status: 'idle' });
    };
    element.onerror = () => {
      setPlayback({ url, status: 'unavailable' });
    };
    element.currentTime = 0;
    setPlayback({ url, status: 'playing' });
    element.play().catch(() => {
      setPlayback({ url, status: 'unavailable' });
    });
  };

  return { status, toggle, stop };
}

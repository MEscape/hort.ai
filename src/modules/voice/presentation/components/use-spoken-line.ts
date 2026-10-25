'use client';

import { useCallback, useEffect, useRef } from 'react';

import type { SystemPhrase } from '../../application/contracts/voice-constraints';

/** Clips already fetched in this tab, by speaker and line: a line costs one synthesis per page load. */
const clips = new Map<string, Promise<string | null>>();

/** For tests: forgets every clip. */
export function resetSpokenLineCache(): void {
  clips.clear();
}

async function fetchClip(speakerId: string, phrase: SystemPhrase): Promise<string | null> {
  try {
    const response = await fetch('/api/voice/speech', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ speakerId, phrase }),
    });
    return response.ok ? URL.createObjectURL(await response.blob()) : null;
  } catch {
    // Offline or the provider is down: the line stays text.
    return null;
  }
}

/** The clip of a line, from memory when this tab already has it. A failure is not remembered. */
function clipOf(speakerId: string, phrase: SystemPhrase): Promise<string | null> {
  const key = `${speakerId}:${phrase}`;
  const known = clips.get(key);
  if (known !== undefined) {
    return known;
  }
  const pending = fetchClip(speakerId, phrase).then((url) => {
    if (url === null) {
      clips.delete(key);
    }
    return url;
  });
  clips.set(key, pending);
  return pending;
}

interface UseSpokenLineOptions {
  /** A tutor id the voice module knows (`max`, `lili`, `fina`). */
  readonly speakerId: string;
  /** False: nothing is requested and nothing plays (voice off, or a language the voices do not speak). */
  readonly isAllowed: boolean;
}

export interface SpokenLine {
  /** Says a fixed line in the speaker's voice. Always the text is shown too; sound is a bonus that may silently not happen. */
  readonly speak: (phrase: SystemPhrase) => Promise<void>;
  readonly stop: () => void;
}

/**
 * Plays the fixed lines of the voice module (`POST /api/voice/speech` names a line, it never sends
 * words). One voice at a time: a new line, `stop` or leaving the screen ends the one that is
 * playing, and a clip that arrives after a newer request is dropped. A refused request, a network
 * failure and a browser that blocks sound before the first tap all end quietly in text only.
 */
export function useSpokenLine({ speakerId, isAllowed }: UseSpokenLineOptions): SpokenLine {
  const playing = useRef<HTMLAudioElement | null>(null);
  const latest = useRef(0);

  const stop = useCallback(() => {
    latest.current += 1;
    playing.current?.pause();
    playing.current = null;
  }, []);

  const speak = useCallback(
    async (phrase: SystemPhrase) => {
      stop();
      if (!isAllowed) {
        return;
      }
      const request = latest.current;
      const url = await clipOf(speakerId, phrase);
      if (url === null || request !== latest.current) {
        return;
      }
      const audio = new Audio(url);
      playing.current = audio;
      try {
        await audio.play();
      } catch {
        // The browser blocks sound until the child has tapped once: text only, no error.
      }
    },
    [isAllowed, speakerId, stop],
  );

  useEffect(() => stop, [stop]);

  return { speak, stop };
}

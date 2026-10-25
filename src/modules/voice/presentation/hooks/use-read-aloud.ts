'use client';

import { useEffect, useRef, useState } from 'react';

import type { CompanionMessageRef } from '../../application/contracts/voice-constraints';
import { readAloudAction } from '../actions/read-aloud-action';

export type ReadAloudStatus = 'idle' | 'loading' | 'playing';

/** Why nothing played; the text stays on the screen either way. */
export type ReadAloudProblem = 'consent_required' | 'busy' | 'failed';

export interface ReadAloud {
  readonly status: ReadAloudStatus;
  readonly problem: ReadAloudProblem | null;
  /** Reads the message aloud, or stops it while it plays. */
  readonly toggle: () => void;
}

const SPEECH_URL = '/api/voice/speech';

class ReadAloudError extends Error {
  constructor(readonly problem: ReadAloudProblem) {
    super(problem);
  }
}

function problemOf(code: unknown): ReadAloudProblem {
  if (code === 'voice.consent_required' || code === 'voice.child_profile_not_found') {
    return 'consent_required';
  }
  return code === 'voice.rate_limited' ? 'busy' : 'failed';
}

/** Asks the server for the message's ticket, then for its audio: the browser never sends words. */
async function fetchSpeech(childProfileId: string, message: CompanionMessageRef): Promise<string> {
  const issued = await readAloudAction({ childProfileId, message });
  if (!issued.ok) {
    throw new ReadAloudError(problemOf(issued.error.code));
  }
  const response = await fetch(SPEECH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ speakerId: issued.data.speakerId, ticket: issued.data.ticket }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { readonly code?: unknown } | null;
    throw new ReadAloudError(problemOf(body?.code));
  }
  return URL.createObjectURL(await response.blob());
}

/**
 * Reads one message of the companion aloud in the companion's voice (#34). The audio of this
 * message is fetched once and kept for the life of the button, so listening again costs no
 * further characters of the speech budget. The `<audio>` element is created inside the press, so
 * browsers that need a gesture allow the sound that arrives a moment later.
 */
export function useReadAloud(childProfileId: string, message: CompanionMessageRef): ReadAloud {
  const [status, setStatus] = useState<ReadAloudStatus>('idle');
  const [problem, setProblem] = useState<ReadAloudProblem | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
      if (urlRef.current !== null) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    },
    [],
  );

  const play = async (audio: HTMLAudioElement) => {
    try {
      if (urlRef.current === null) {
        setStatus('loading');
        urlRef.current = await fetchSpeech(childProfileId, message);
      }
      if (audioRef.current !== audio) {
        return;
      }
      Object.assign(audio, {
        src: urlRef.current,
        onended: () => {
          setStatus('idle');
        },
        onerror: () => {
          setStatus('idle');
          setProblem('failed');
        },
      });
      setStatus('playing');
      await audio.play();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setStatus('idle');
      setProblem(error instanceof ReadAloudError ? error.problem : 'failed');
    }
  };

  return {
    status,
    problem,
    toggle: () => {
      if (status === 'loading') {
        return;
      }
      if (status === 'playing') {
        audioRef.current?.pause();
        setStatus('idle');
        return;
      }
      setProblem(null);
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.currentTime = 0;
      void play(audio);
    },
  };
}

'use client';

import { useCharacterVoice } from '@hooks/use-character-voice';

export type VoicePreviewPhase =
  /** No sound file at all: nothing to retry. */
  | 'unavailable'
  /** The sound failed to start or play: a new press tries again. */
  | 'failed'
  /** Pressed, but the sound has not begun yet. */
  | 'loading'
  | 'listening'
  | 'ready';

/**
 * The story of one spoken preview as a single phase, built on `useCharacterVoice`: an empty address
 * is `unavailable`, a sound that failed is `failed` (retry), and between the press and the first
 * sound it is `loading`. It never plays by itself, plays one sound at a time, and stops when the
 * address changes or the screen is left (the voice hook does that).
 */
export function useVoicePreview(url: string) {
  const voice = useCharacterVoice(url, { trackProgress: true });
  let phase: VoicePreviewPhase = 'ready';
  if (url === '') {
    phase = 'unavailable';
  } else if (voice.status === 'unavailable') {
    phase = 'failed';
  } else if (voice.status === 'playing') {
    phase = voice.isBuffering ? 'loading' : 'listening';
  }
  return { phase, progress: voice.progress, toggle: voice.toggle };
}

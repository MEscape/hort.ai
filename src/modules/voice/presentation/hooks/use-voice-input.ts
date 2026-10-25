'use client';

import { useEffect, useRef, useState } from 'react';

import { SPEECH_LIMITS } from '../../application/contracts/voice-constraints';

export type VoiceInputStatus = 'idle' | 'recording' | 'transcribing';

/** Why the microphone did not help; the child then simply types. */
export type VoiceInputProblem =
  'mic_denied' | 'unsupported' | 'nothing_heard' | 'consent_required' | 'busy' | 'failed';

export interface VoiceInput {
  readonly status: VoiceInputStatus;
  readonly problem: VoiceInputProblem | null;
  /** Starts listening, or stops and transcribes while it listens. */
  readonly toggle: () => void;
  /** Stops and transcribes; nothing happens while not listening. */
  readonly stop: () => void;
}

/** A recording stops by itself after this long, well within the provider's size limit. */
const MAX_RECORDING_MS = 30_000;
/** Types the voice module accepts, in the order a browser is asked for them. */
const RECORDING_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg'] as const;
const TRANSCRIPTION_URL = '/api/voice/transcription';

function supportedType(): string | undefined {
  return RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function problemOf(code: unknown): VoiceInputProblem {
  if (code === 'voice.consent_required' || code === 'voice.child_profile_not_found') {
    return 'consent_required';
  }
  if (code === 'voice.rate_limited') {
    return 'busy';
  }
  return 'failed';
}

async function transcribe(childProfileId: string, recording: Blob): Promise<string> {
  const form = new FormData();
  form.append('childProfileId', childProfileId);
  form.append('audio', recording, 'aufnahme');
  const response = await fetch(TRANSCRIPTION_URL, { method: 'POST', body: form });
  const body = (await response.json().catch(() => null)) as {
    readonly text?: unknown;
    readonly code?: unknown;
  } | null;
  if (!response.ok || typeof body?.text !== 'string') {
    throw new VoiceInputError(problemOf(body?.code));
  }
  return body.text;
}

class VoiceInputError extends Error {
  constructor(readonly problem: VoiceInputProblem) {
    super(problem);
  }
}

/**
 * The child speaks instead of typing (#34): the browser records only while the child asks it to,
 * the recording goes once to the voice module (which checks the parent's consent and sends it to
 * the provider without storing it) and the transcript is handed to `onTranscript`, so the field
 * shows it and the child can correct it before sending. A refused microphone, a missing
 * MediaRecorder or any failure ends in a `problem`, and typing always keeps working.
 */
export function useVoiceInput(
  childProfileId: string,
  onTranscript: (text: string) => void,
): VoiceInput {
  const [status, setStatus] = useState<VoiceInputStatus>('idle');
  const [problem, setProblem] = useState<VoiceInputProblem | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** True while the browser asks for the microphone, so a second tap starts nothing. */
  const startingRef = useRef(false);
  const mountedRef = useRef(true);
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder !== null) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        recorder.stream.getTracks().forEach((track) => {
          track.stop();
        });
      }
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const stop = () => {
    const recorder = recorderRef.current;
    if (recorder !== null && recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const finish = async (recording: Blob) => {
    if (recording.size === 0) {
      setProblem('nothing_heard');
      setStatus('idle');
      return;
    }
    if (recording.size > SPEECH_LIMITS.maxRecordingBytes) {
      setProblem('failed');
      setStatus('idle');
      return;
    }
    setStatus('transcribing');
    try {
      const text = (await transcribe(childProfileId, recording)).trim();
      if (!mountedRef.current) {
        return;
      }
      if (text === '') {
        setProblem('nothing_heard');
      } else {
        onTranscriptRef.current(text);
      }
    } catch (error) {
      setProblem(error instanceof VoiceInputError ? error.problem : 'failed');
    }
    setStatus('idle');
  };

  const start = async () => {
    setProblem(null);
    if (typeof MediaRecorder === 'undefined' || !('mediaDevices' in navigator)) {
      setProblem('unsupported');
      return;
    }
    if (startingRef.current) {
      return;
    }
    startingRef.current = true;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setProblem('mic_denied');
      return;
    } finally {
      startingRef.current = false;
    }
    if (!mountedRef.current) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      return;
    }
    const type = supportedType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, type === undefined ? undefined : { mimeType: type });
    } catch {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      setProblem('unsupported');
      return;
    }
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      recorderRef.current = null;
      void finish(
        new Blob(chunks, {
          type: recorder.mimeType === '' ? (type ?? 'audio/webm') : recorder.mimeType,
        }),
      );
    };
    recorderRef.current = recorder;
    recorder.start();
    timerRef.current = setTimeout(stop, MAX_RECORDING_MS);
    setStatus('recording');
  };

  return {
    status,
    problem,
    toggle: () => {
      if (status === 'recording') {
        stop();
      } else if (status === 'idle') {
        void start();
      }
    },
    stop,
  };
}

import { z } from 'zod';

import { MS_PER_MINUTE } from '@lib/utils';

import { httpUrl, integerSetting } from './env-primitives';

const DEFAULT_ELEVENLABS_API_URL = 'https://api.elevenlabs.io';
/** Multilingual, speaks German well; every voice of the tutor catalog was tested with it. */
const DEFAULT_ELEVENLABS_TTS_MODEL_ID = 'eleven_multilingual_v2';
const DEFAULT_ELEVENLABS_STT_MODEL_ID = 'scribe_v1';
const DEFAULT_ELEVENLABS_TIMEOUT_MS = 20_000;
const MAX_ELEVENLABS_TIMEOUT_MS = MS_PER_MINUTE;
const MIN_ELEVENLABS_TIMEOUT_MS = 1000;

/** ElevenLabs model ids: lower-case letters, digits and `_`, for example `eleven_flash_v2_5`. */
const modelId = z.string().regex(/^[a-z0-9_]{1,64}$/, {
  error: 'Must be an ElevenLabs model id of lower-case letters, digits and "_".',
});

/** An API key is one opaque token; whitespace inside it is always a copy-and-paste mistake. */
const apiKey = z.string().regex(/^\S{20,200}$/, {
  error: 'Must be the ElevenLabs API key (20-200 characters, no spaces).',
});

/**
 * Speech (text-to-speech for the tutors' voices, speech-to-text for the child) through ElevenLabs.
 *
 * Optional on purpose: without `ELEVENLABS_API_KEY` the app starts and speech is simply off; the
 * voice endpoints answer `voice.disabled` and the interface stays usable with text. The key is
 * server-only and never reaches the browser.
 */
export const speechEnvSchema = z.object({
  /** Server-only secret. Never log it, never ship it to the browser. */
  ELEVENLABS_API_KEY: apiKey.optional(),
  /** The API origin. Only tests and a proxy change it; production demands https. */
  ELEVENLABS_API_URL: httpUrl.default(DEFAULT_ELEVENLABS_API_URL),
  ELEVENLABS_TTS_MODEL_ID: modelId.default(DEFAULT_ELEVENLABS_TTS_MODEL_ID),
  ELEVENLABS_STT_MODEL_ID: modelId.default(DEFAULT_ELEVENLABS_STT_MODEL_ID),
  /** How long one provider call may take before it counts as unavailable. */
  ELEVENLABS_TIMEOUT_MS: integerSetting(DEFAULT_ELEVENLABS_TIMEOUT_MS, {
    min: MIN_ELEVENLABS_TIMEOUT_MS,
    max: MAX_ELEVENLABS_TIMEOUT_MS,
  }),
});

export type SpeechEnv = z.infer<typeof speechEnvSchema>;

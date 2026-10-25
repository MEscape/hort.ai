import { z } from 'zod';

import { MS_PER_MINUTE } from '@lib/utils';

import { httpUrl, integerSetting } from './env-primitives';

const DEFAULT_GEMINI_API_URL = 'https://generativelanguage.googleapis.com';
/** Gemini 3.8 Flash: fast, and free of charge on the Gemini API's free tier. */
const DEFAULT_GEMINI_MODEL_ID = 'gemini-3.8-flash';
/** A child waits for the answer; a slower call falls back to the predefined prompt. */
const DEFAULT_GEMINI_TIMEOUT_MS = 8000;
const MIN_GEMINI_TIMEOUT_MS = 1000;
const MAX_GEMINI_TIMEOUT_MS = MS_PER_MINUTE;

/** A Gemini model id such as `gemini-3.8-flash`. */
const modelId = z.string().regex(/^[a-z0-9][a-z0-9.-]{0,63}$/, {
  error: 'Must be a Gemini model id such as "gemini-3.8-flash".',
});

/** An API key is one opaque token; whitespace inside it is always a copy-and-paste mistake. */
const apiKey = z.string().regex(/^\S{20,200}$/, {
  error: 'Must be the Gemini API key from Google AI Studio (20-200 characters, no spaces).',
});

/**
 * The AI model behind hints and answer feedback (#10, #14): Gemini through the Gemini API, with a
 * key from Google AI Studio.
 *
 * For the hackathon demo only: the Gemini API terms exclude services likely to be used by people
 * under 18, and its free tier uses prompts to improve Google's products. The provider must be
 * re-assessed before any test with children.
 *
 * Optional on purpose: without `GEMINI_API_KEY` the app starts and the AI is off; every hint is
 * then the predefined prompt of its level.
 */
export const aiEnvSchema = z.object({
  /** Server-only secret. Never log it, never ship it to the browser. */
  GEMINI_API_KEY: apiKey.optional(),
  /** The API origin. Only tests and a proxy change it; production demands https. */
  GEMINI_API_URL: httpUrl.default(DEFAULT_GEMINI_API_URL),
  GEMINI_MODEL_ID: modelId.default(DEFAULT_GEMINI_MODEL_ID),
  /** How long one model call may take before it counts as a timeout. */
  GEMINI_TIMEOUT_MS: integerSetting(DEFAULT_GEMINI_TIMEOUT_MS, {
    min: MIN_GEMINI_TIMEOUT_MS,
    max: MAX_GEMINI_TIMEOUT_MS,
  }),
});

export type AiEnv = z.infer<typeof aiEnvSchema>;

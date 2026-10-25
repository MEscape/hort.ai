import { z } from 'zod';

import { MS_PER_MINUTE } from '@lib/utils';

import { httpUrl, integerSetting } from './env-primitives';

const DEFAULT_TYPESAFE_API_URL = 'https://api.typesafe.ai';
/** Pinned: `jev-latest` would change the safety check without a review. */
const DEFAULT_TYPESAFE_MODEL_ID = 'jev-1.14.0';
/** Jev answers in about a tenth of a second; the child is already waiting for the hint. */
const DEFAULT_TYPESAFE_TIMEOUT_MS = 3000;
const MIN_TYPESAFE_TIMEOUT_MS = 500;
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

/** A Jev model id such as `jev-1.14.0`. */
const jevModelId = z.string().regex(/^jev-[a-z0-9.-]{1,32}$/, {
  error: 'Must be a Jev model id such as "jev-1.14.0".',
});

/** An API key is one opaque token; whitespace inside it is always a copy-and-paste mistake. */
const apiKey = (provider: string) =>
  z.string().regex(/^\S{20,200}$/, {
    error: `Must be the ${provider} API key (20-200 characters, no spaces).`,
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
 * then the predefined prompt of its level. With `TYPESAFE_API_KEY`, TypeSafe's Jev rates every AI
 * text against the child-safety rules as a second check after the word lists.
 */
export const aiEnvSchema = z.object({
  /** Server-only secret. Never log it, never ship it to the browser. */
  GEMINI_API_KEY: apiKey('Gemini').optional(),
  /** The API origin. Only tests and a proxy change it; production demands https. */
  GEMINI_API_URL: httpUrl.default(DEFAULT_GEMINI_API_URL),
  GEMINI_MODEL_ID: modelId.default(DEFAULT_GEMINI_MODEL_ID),
  /** How long one model call may take before it counts as a timeout. */
  GEMINI_TIMEOUT_MS: integerSetting(DEFAULT_GEMINI_TIMEOUT_MS, {
    min: MIN_GEMINI_TIMEOUT_MS,
    max: MAX_GEMINI_TIMEOUT_MS,
  }),
  /** Server-only secret. Never log it, never ship it to the browser. */
  TYPESAFE_API_KEY: apiKey('TypeSafe').optional(),
  /** The API origin. Only tests and a proxy change it; production demands https. */
  TYPESAFE_API_URL: httpUrl.default(DEFAULT_TYPESAFE_API_URL),
  TYPESAFE_MODEL_ID: jevModelId.default(DEFAULT_TYPESAFE_MODEL_ID),
  /** How long one safety check may take; a slower one keeps the AI text from the child. */
  TYPESAFE_TIMEOUT_MS: integerSetting(DEFAULT_TYPESAFE_TIMEOUT_MS, {
    min: MIN_TYPESAFE_TIMEOUT_MS,
    max: MAX_GEMINI_TIMEOUT_MS,
  }),
});

export type AiEnv = z.infer<typeof aiEnvSchema>;

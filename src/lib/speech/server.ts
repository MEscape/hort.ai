import 'server-only';

import { serverEnv } from '@lib/config/server';
import { once } from '@lib/utils';

import { createSpeechProvider } from './create-speech-provider';

import type { SpeechProvider } from './speech-provider';

/**
 * The one speech provider of this process, or `null` while speech is off. Built on first use, so
 * importing this needs no speech configuration at build time. Only `composition.ts` files call it
 * and hand the result to use cases as a `SpeechProvider`.
 */
export const getSpeechProvider = once<SpeechProvider | null>(() => createSpeechProvider(serverEnv));

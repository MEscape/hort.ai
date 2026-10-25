import { vi } from 'vitest';

import type { Actor, AuthorizationService } from '@modules/auth';
import type { VoiceDependencies } from '@modules/voice/application/voice-dependencies';

import { forbiddenError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { SpeechProvider } from '@lib/speech';

import { createTestRateLimiter } from '../../support/rate-limiting';

export function actor(id = 'parent-1'): Actor {
  return { id, tenantId: 'default', roles: ['parent'] } as unknown as Actor;
}

export function allowing(who: Actor = actor()): AuthorizationService {
  return {
    requireInTenant: vi.fn(() => okAsync(who)),
    requireOnResource: vi.fn(() => okAsync(who)),
  };
}

export function denying(): AuthorizationService {
  const denied = () => errAsync(forbiddenError('auth.permission_denied', 'Denied.'));
  return { requireInTenant: vi.fn(denied), requireOnResource: vi.fn(denied) };
}

interface FakeSpeech extends SpeechProvider {
  readonly synthesize: ReturnType<typeof vi.fn<SpeechProvider['synthesize']>>;
  readonly transcribe: ReturnType<typeof vi.fn<SpeechProvider['transcribe']>>;
}

export function fakeSpeech(): FakeSpeech {
  return {
    synthesize: vi.fn<SpeechProvider['synthesize']>(() =>
      okAsync({ audio: new Uint8Array([0xff, 0xfb]), contentType: 'audio/mpeg' as const }),
    ),
    transcribe: vi.fn<SpeechProvider['transcribe']>(() =>
      okAsync({ text: 'Was ist drei mal vier?', languageCode: 'deu' }),
    ),
  };
}

export function voiceDependencies(overrides: Partial<VoiceDependencies> = {}): VoiceDependencies {
  return {
    authorization: allowing(),
    rateLimiter: createTestRateLimiter(),
    speech: fakeSpeech(),
    voices: { voiceFor: (id) => (id === 'max' ? 'VoiceMax' : null) },
    phrases: {
      phraseFor: (id, phrase) => (id === 'max' && phrase === 'greeting' ? 'Wuff, hallo!' : null),
    },
    tickets: {
      issue: vi.fn((text: string) => `ticket:${text}`),
      redeem: vi.fn((ticket: string) => (ticket.startsWith('ticket:') ? ticket.slice(7) : null)),
    },
    consent: { voiceConsentOf: vi.fn(() => okAsync(true)) },
    ...overrides,
  };
}

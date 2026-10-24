import { vi } from 'vitest';

import type { Actor, AuthorizationService } from '@modules/auth';
import type { VoiceDependencies } from '@modules/voice/application/voice-dependencies';
import type { VoiceConsent } from '@modules/voice/domain/models/voice-consent';
import type { VoiceConsentRepository } from '@modules/voice/domain/ports/voice-consent.repository';

import { forbiddenError, infrastructureError } from '@lib/errors';
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

export const NOW = new Date('2026-10-24T10:00:00.000Z');

interface FakeConsents extends VoiceConsentRepository {
  readonly find: ReturnType<typeof vi.fn<VoiceConsentRepository['find']>>;
}

/** A consent store holding one record (`null` = never granted); grant and revoke update it. */
export function fakeConsents(initial: VoiceConsent | null = { grantedAt: NOW, revokedAt: null }) {
  let stored = initial;
  const consents: FakeConsents = {
    find: vi.fn<VoiceConsentRepository['find']>(() => okAsync(stored)),
    grant: vi.fn<VoiceConsentRepository['grant']>((_holder, at) => {
      stored = { grantedAt: at, revokedAt: null };
      return okAsync(stored);
    }),
    revoke: vi.fn<VoiceConsentRepository['revoke']>((_holder, at) => {
      if (stored !== null && stored.revokedAt === null) {
        stored = { ...stored, revokedAt: at };
      }
      return okAsync(stored);
    }),
  };
  return consents;
}

/** A consent store that cannot be read. */
export function unreadableConsents(): VoiceConsentRepository {
  const failure = () =>
    errAsync(infrastructureError('voice.persistence_failed', 'VoiceConsent persistence failed.'));
  return { find: vi.fn(failure), grant: vi.fn(failure), revoke: vi.fn(failure) };
}

const VOICES = new Map([
  ['max', 'VoiceMax'],
  ['eule', 'VoiceOwl'],
]);

export function voiceDependencies(overrides: Partial<VoiceDependencies> = {}): VoiceDependencies {
  return {
    authorization: allowing(),
    rateLimiter: createTestRateLimiter(),
    speech: fakeSpeech(),
    voices: {
      voiceFor: (id) => VOICES.get(id) ?? null,
      isFixedLine: (id, text) => id === 'eule' && text === 'Willkommen bei Hort.ai!',
    },
    textGuard: { isSafe: (text) => !/geheimnis|https?:/i.test(text) },
    consents: fakeConsents(),
    audit: { record: vi.fn() },
    clock: { now: () => NOW },
    ...overrides,
  };
}

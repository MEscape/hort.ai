import { describe, expect, it, vi } from 'vitest';

import { CONNECTION_TEST_SENTENCE } from '@modules/alexa/infrastructure/connection-test/connection-test-tutor';
import type { HostedSpeechSource } from '@modules/voice/application/contracts/voice-inputs';
import { GetHostedSpeech } from '@modules/voice/application/queries/get-hosted-speech';
import { VOICE_RATE_LIMITS } from '@modules/voice/application/rate-limits';
import type { HostedSpeechDependencies } from '@modules/voice/application/voice-dependencies';
import type {
  ClipContent,
  HostedClip,
  SpeechClips,
} from '@modules/voice/domain/ports/speech-clips.port';
import { catalogChannelLines } from '@modules/voice/infrastructure/catalog/catalog-channel-lines';

import { infrastructureError } from '@lib/errors';
import type { RateLimiter } from '@lib/rate-limit';
import { errAsync, ok, okAsync, ResultAsync } from '@lib/result';
import type { SpeechProvider } from '@lib/speech';

import { createBrokenRateLimiter, createTestRateLimiter } from '../../../support/rate-limiting';
import { fakeSpeech } from '../fakes';

const EXPIRES = new Date('2026-10-25T12:15:00.000Z');

/** Most tests are about caching, not about which lines are allowed: every line passes here. */
function line(text: string): HostedSpeechSource {
  return { kind: 'channel-line', text };
}

function memoryClips() {
  const stored = new Map<string, Uint8Array>();
  const keyOf = (content: ClipContent) => `${content.voice}|${content.text}`;
  const clipOf = (content: ClipContent): HostedClip => ({
    url: `https://clips.example/${encodeURIComponent(keyOf(content))}?sig=x`,
    expiresAt: EXPIRES,
  });
  const clips = {
    find: vi.fn<SpeechClips['find']>((content) =>
      okAsync(stored.has(keyOf(content)) ? clipOf(content) : null),
    ),
    save: vi.fn<SpeechClips['save']>((content, audio) => {
      stored.set(keyOf(content), audio);
      return okAsync(clipOf(content));
    }),
  };
  return { clips, stored };
}

function dependencies(overrides: Partial<HostedSpeechDependencies> = {}): HostedSpeechDependencies {
  return {
    rateLimiter: createTestRateLimiter(),
    speech: fakeSpeech(),
    voices: { voiceFor: (id) => (id === 'max' ? 'VoiceMax' : null) },
    phrases: {
      phraseFor: (id, phrase) => (id === 'max' && phrase === 'greeting' ? 'Wuff!' : null),
    },
    channelLines: { isChannelLine: () => true },
    clips: memoryClips().clips,
    ...overrides,
  };
}

describe('GetHostedSpeech', () => {
  it('synthesizes a text once and serves the stored clip afterwards', async () => {
    const speech = fakeSpeech();
    const { clips, stored } = memoryClips();
    const query = new GetHostedSpeech(dependencies({ speech, clips }));

    const first = await query.execute({ speakerId: 'max', source: line('  Hallo Lennart  ') });
    const second = await query.execute({ speakerId: 'max', source: line('Hallo Lennart') });

    expect(first._unsafeUnwrap()).toEqual({
      url: 'https://clips.example/VoiceMax%7CHallo%20Lennart?sig=x',
      expiresAt: EXPIRES,
    });
    expect(second._unsafeUnwrap()).toEqual(first._unsafeUnwrap());
    expect(speech.synthesize).toHaveBeenCalledExactlyOnceWith({
      voiceId: 'VoiceMax',
      text: 'Hallo Lennart',
    });
    expect(clips.save).toHaveBeenCalledExactlyOnceWith(
      { voice: 'VoiceMax', text: 'Hallo Lennart' },
      new Uint8Array([0xff, 0xfb]),
      'audio/mpeg',
    );
    expect(stored.size).toBe(1);
  });

  it('answers voice.disabled without a provider and voice.hosting_disabled without storage', async () => {
    const noSpeech = new GetHostedSpeech(dependencies({ speech: null }));
    const noStorage = new GetHostedSpeech(dependencies({ clips: null }));

    expect(
      (await noSpeech.execute({ speakerId: 'max', source: line('Hallo') }))._unsafeUnwrapErr().code,
    ).toBe('voice.disabled');
    expect(
      (await noStorage.execute({ speakerId: 'max', source: line('Hallo') }))._unsafeUnwrapErr()
        .code,
    ).toBe('voice.hosting_disabled');
  });

  it('refuses an unknown speaker and invalid text before touching storage or the provider', async () => {
    const speech = fakeSpeech();
    const { clips } = memoryClips();
    const query = new GetHostedSpeech(dependencies({ speech, clips }));

    const unknown = await query.execute({ speakerId: 'tiger', source: line('Hallo') });
    const malformed = await query.execute({ speakerId: 'Max!', source: line('Hallo') });
    const empty = await query.execute({ speakerId: 'max', source: line('  ') });

    expect(unknown._unsafeUnwrapErr().code).toBe('voice.unknown_speaker');
    expect(malformed._unsafeUnwrapErr().code).toBe('voice.validation_failed');
    expect(empty._unsafeUnwrapErr().code).toBe('voice.validation_failed');
    expect(clips.find).not.toHaveBeenCalled();
    expect(speech.synthesize).not.toHaveBeenCalled();
  });

  it('spends the global budget only on a synthesis', async () => {
    const speech = fakeSpeech();
    const query = new GetHostedSpeech(dependencies({ speech }));
    for (let attempt = 0; attempt < VOICE_RATE_LIMITS.hostedSynthesize.limit; attempt += 1) {
      expect(
        (await query.execute({ speakerId: 'max', source: line(`Satz ${attempt}`) })).isOk(),
      ).toBe(true);
    }

    const cached = await query.execute({ speakerId: 'max', source: line('Satz 0') });
    const refused = await query.execute({ speakerId: 'max', source: line('Neuer Satz') });

    expect(cached.isOk()).toBe(true);
    expect(refused._unsafeUnwrapErr().code).toBe('voice.rate_limited');
    expect(speech.synthesize).toHaveBeenCalledTimes(VOICE_RATE_LIMITS.hostedSynthesize.limit);
  });

  it('does not synthesize while the limiter store is down', async () => {
    const speech = fakeSpeech();
    const query = new GetHostedSpeech(
      dependencies({ speech, rateLimiter: createBrokenRateLimiter() }),
    );

    const result = await query.execute({ speakerId: 'max', source: line('Hallo') });

    expect(result._unsafeUnwrapErr().code).toBe('voice.rate_limiter_failed');
    expect(speech.synthesize).not.toHaveBeenCalled();
  });

  it('passes provider and storage failures on without storing anything', async () => {
    const failing = fakeSpeech();
    failing.synthesize.mockReturnValue(
      errAsync(infrastructureError('speech.unavailable', 'Down.')),
    );
    const { clips } = memoryClips();
    const providerDown = new GetHostedSpeech(dependencies({ speech: failing, clips }));
    const storageDown = new GetHostedSpeech(
      dependencies({
        clips: {
          find: () => errAsync(infrastructureError('voice.clip_failed', 'Down.')),
          save: clips.save,
        },
      }),
    );

    expect(
      (await providerDown.execute({ speakerId: 'max', source: line('Hallo') }))._unsafeUnwrapErr()
        .code,
    ).toBe('speech.unavailable');
    expect(
      (await storageDown.execute({ speakerId: 'max', source: line('Hallo') }))._unsafeUnwrapErr()
        .code,
    ).toBe('voice.clip_failed');
    expect(clips.save).not.toHaveBeenCalled();
  });

  it('synthesizes concurrent misses of the same clip once and shares the result', async () => {
    let open: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const synthesize = vi.fn<SpeechProvider['synthesize']>(
      () =>
        new ResultAsync(
          gate.then(() =>
            ok({ audio: new Uint8Array([0xff, 0xfb]), contentType: 'audio/mpeg' as const }),
          ),
        ),
    );
    const { clips } = memoryClips();
    const limiter = createTestRateLimiter();
    const enforce = vi.fn<RateLimiter['enforce']>((request) => limiter.enforce(request));
    const query = new GetHostedSpeech(
      dependencies({
        speech: { ...fakeSpeech(), synthesize },
        clips,
        rateLimiter: { ...limiter, enforce },
      }),
    );

    const burst = Array.from({ length: 5 }, () =>
      query.execute({ speakerId: 'max', source: line('Hallo Lennart') }),
    );
    const other = query.execute({ speakerId: 'max', source: line('Tschüss Lennart') });
    await vi.waitFor(() => {
      expect(synthesize).toHaveBeenCalledTimes(2);
    });
    open();
    const results = await Promise.all(burst);

    expect(new Set(results.map((result) => result._unsafeUnwrap().url)).size).toBe(1);
    expect((await other).isOk()).toBe(true);
    expect(synthesize).toHaveBeenCalledTimes(2);
    expect(clips.find).toHaveBeenCalledTimes(2);
    expect(clips.save).toHaveBeenCalledTimes(2);
    expect(enforce).toHaveBeenCalledTimes(2);
  });

  it('starts a new flight once the previous one has settled, also after a failure', async () => {
    const synthesize = vi
      .fn<SpeechProvider['synthesize']>()
      .mockReturnValueOnce(errAsync(infrastructureError('speech.provider_failed', 'Down.')))
      .mockImplementation(() => fakeSpeech().synthesize({ voiceId: 'VoiceMax', text: 'Hallo' }));
    const query = new GetHostedSpeech(
      dependencies({ speech: { ...fakeSpeech(), synthesize }, clips: memoryClips().clips }),
    );

    const failed = await query.execute({ speakerId: 'max', source: line('Hallo Lennart') });
    const retried = await query.execute({ speakerId: 'max', source: line('Hallo Lennart') });

    expect(failed.isErr()).toBe(true);
    expect(retried.isOk()).toBe(true);
    expect(synthesize).toHaveBeenCalledTimes(2);
  });

  it('speaks only fixed lines: refuses free text before storage or the provider', async () => {
    const speech = fakeSpeech();
    const { clips } = memoryClips();
    const query = new GetHostedSpeech(
      dependencies({ speech, clips, channelLines: catalogChannelLines() }),
    );

    const free = await query.execute({ speakerId: 'max', source: line('Lennart ist acht.') });
    const unknown = await query.execute({
      speakerId: 'max',
      source: { kind: 'phrase', phrase: 'tip' },
    });

    expect(free._unsafeUnwrapErr()).toMatchObject({
      code: 'voice.validation_failed',
      fieldErrors: { text: ['voice.validation.free_text_refused'] },
    });
    expect(unknown._unsafeUnwrapErr().code).toBe('voice.unknown_phrase');
    expect(clips.find).not.toHaveBeenCalled();
    expect(speech.synthesize).not.toHaveBeenCalled();
  });

  it('speaks a catalog phrase and the configured Alexa connection-test sentence', async () => {
    const speech = fakeSpeech();
    const query = new GetHostedSpeech(
      dependencies({ speech, channelLines: catalogChannelLines() }),
    );

    const phrase = await query.execute({
      speakerId: 'max',
      source: { kind: 'phrase', phrase: 'greeting' },
    });
    const channel = await query.execute({
      speakerId: 'max',
      source: line(` ${CONNECTION_TEST_SENTENCE} `),
    });

    expect(phrase.isOk()).toBe(true);
    expect(channel.isOk()).toBe(true);
    expect(speech.synthesize).toHaveBeenNthCalledWith(1, { voiceId: 'VoiceMax', text: 'Wuff!' });
    expect(speech.synthesize).toHaveBeenNthCalledWith(2, {
      voiceId: 'VoiceMax',
      text: CONNECTION_TEST_SENTENCE,
    });
  });
});

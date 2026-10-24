import { describe, expect, it } from 'vitest';

import { SPEECH_LIMITS } from '@modules/voice/application/contracts/voice-constraints';
import { SynthesizeSpeech } from '@modules/voice/application/queries/synthesize-speech';
import { VOICE_RATE_LIMITS } from '@modules/voice/application/rate-limits';

import { createBrokenRateLimiter, createTestRateLimiter } from '../../../support/rate-limiting';
import { actor, allowing, denying, fakeSpeech, voiceDependencies } from '../fakes';

describe('SynthesizeSpeech', () => {
  it('speaks trimmed text in the speaker voice of the catalog', async () => {
    const speech = fakeSpeech();
    const query = new SynthesizeSpeech(voiceDependencies({ speech }));

    const result = await query.execute({ speakerId: 'max', text: '  Super gemacht!  ' });

    expect(result._unsafeUnwrap()).toEqual({
      audio: new Uint8Array([0xff, 0xfb]),
      contentType: 'audio/mpeg',
    });
    expect(speech.synthesize).toHaveBeenCalledWith({ text: 'Super gemacht!', voiceId: 'VoiceMax' });
  });

  it('requires the voice.use permission before anything else', async () => {
    const speech = fakeSpeech();
    const authorization = denying();
    const query = new SynthesizeSpeech(voiceDependencies({ authorization, speech }));

    const result = await query.execute({ speakerId: 'max', text: 'Hallo' });

    expect(result._unsafeUnwrapErr().code).toBe('auth.permission_denied');
    expect(authorization.requireInTenant).toHaveBeenCalledWith('voice.use');
    expect(speech.synthesize).not.toHaveBeenCalled();
  });

  it('answers voice.disabled while no provider is configured', async () => {
    const query = new SynthesizeSpeech(voiceDependencies({ speech: null }));

    const result = await query.execute({ speakerId: 'max', text: 'Hallo' });

    expect(result._unsafeUnwrapErr().code).toBe('voice.disabled');
  });

  it('refuses a speaker without a voice, empty text and text over the limit', async () => {
    const speech = fakeSpeech();
    const query = new SynthesizeSpeech(voiceDependencies({ speech }));

    const unknown = await query.execute({ speakerId: 'tiger', text: 'Hallo' });
    const empty = await query.execute({ speakerId: 'max', text: '   ' });
    const long = await query.execute({
      speakerId: 'max',
      text: 'a'.repeat(SPEECH_LIMITS.maxTextLength + 1),
    });
    const atLimit = await query.execute({
      speakerId: 'max',
      text: '🦉'.repeat(SPEECH_LIMITS.maxTextLength),
    });

    expect(unknown._unsafeUnwrapErr().code).toBe('voice.unknown_speaker');
    expect(empty._unsafeUnwrapErr()).toMatchObject({
      code: 'voice.validation_failed',
      fieldErrors: { text: ['voice.validation.text_required'] },
    });
    expect(long._unsafeUnwrapErr()).toMatchObject({
      fieldErrors: { text: ['voice.validation.text_too_long'] },
    });
    expect(atLimit.isOk()).toBe(true);
    expect(speech.synthesize).toHaveBeenCalledOnce();
  });

  it('refuses once the parent budget is spent, counting each parent separately', async () => {
    const rateLimiter = createTestRateLimiter();
    const query = new SynthesizeSpeech(voiceDependencies({ rateLimiter }));
    for (let attempt = 0; attempt < VOICE_RATE_LIMITS.synthesize.limit; attempt += 1) {
      expect((await query.execute({ speakerId: 'max', text: 'Hallo' })).isOk()).toBe(true);
    }
    const other = new SynthesizeSpeech(
      voiceDependencies({ rateLimiter, authorization: allowing(actor('parent-2')) }),
    );

    const refused = await query.execute({ speakerId: 'max', text: 'Hallo' });

    expect(refused._unsafeUnwrapErr()).toMatchObject({
      kind: 'rate_limited',
      code: 'voice.rate_limited',
    });
    expect((await other.execute({ speakerId: 'max', text: 'Hallo' })).isOk()).toBe(true);
  });

  it('denies when the limiter store is down', async () => {
    const speech = fakeSpeech();
    const query = new SynthesizeSpeech(
      voiceDependencies({ rateLimiter: createBrokenRateLimiter(), speech }),
    );

    const result = await query.execute({ speakerId: 'max', text: 'Hallo' });

    expect(result._unsafeUnwrapErr().code).toBe('voice.rate_limiter_failed');
    expect(speech.synthesize).not.toHaveBeenCalled();
  });
});

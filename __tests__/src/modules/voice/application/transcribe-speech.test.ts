import { describe, expect, it } from 'vitest';

import { SPEECH_LIMITS } from '@modules/voice/application/contracts/voice-constraints';
import { TranscribeSpeech } from '@modules/voice/application/queries/transcribe-speech';

import { errAsync } from '@lib/result';
import { speechQuotaExceeded } from '@lib/speech';

import { createBrokenRateLimiter } from '../../../support/rate-limiting';
import { denying, fakeSpeech, voiceDependencies } from '../fakes';

const recording = { audio: new Uint8Array([1, 2, 3]), contentType: 'audio/webm' };

describe('TranscribeSpeech', () => {
  it('turns a German recording into text', async () => {
    const speech = fakeSpeech();
    const query = new TranscribeSpeech(voiceDependencies({ speech }));

    const result = await query.execute(recording);

    expect(result._unsafeUnwrap()).toEqual({ text: 'Was ist drei mal vier?' });
    expect(speech.transcribe).toHaveBeenCalledWith({ ...recording, languageCode: 'deu' });
  });

  it('requires the voice.use permission', async () => {
    const speech = fakeSpeech();
    const query = new TranscribeSpeech(voiceDependencies({ authorization: denying(), speech }));

    expect((await query.execute(recording))._unsafeUnwrapErr().kind).toBe('forbidden');
    expect(speech.transcribe).not.toHaveBeenCalled();
  });

  it('answers voice.disabled while no provider is configured', async () => {
    const query = new TranscribeSpeech(voiceDependencies({ speech: null }));

    expect((await query.execute(recording))._unsafeUnwrapErr().code).toBe('voice.disabled');
  });

  it.each([
    [{ ...recording, audio: new Uint8Array() }, 'voice.validation.recording_required'],
    [
      { ...recording, audio: new Uint8Array(SPEECH_LIMITS.maxRecordingBytes + 1) },
      'voice.validation.recording_too_large',
    ],
    [{ ...recording, contentType: 'video/mp4' }, 'voice.validation.recording_type_unsupported'],
  ])('refuses an unusable recording (%#)', async (input, code) => {
    const speech = fakeSpeech();
    const query = new TranscribeSpeech(voiceDependencies({ speech }));

    expect((await query.execute(input))._unsafeUnwrapErr()).toMatchObject({
      fieldErrors: { audio: [code] },
    });
    expect(speech.transcribe).not.toHaveBeenCalled();
  });

  it('denies when the limiter store is down and passes provider failures on', async () => {
    const broken = new TranscribeSpeech(
      voiceDependencies({ rateLimiter: createBrokenRateLimiter() }),
    );
    const speech = fakeSpeech();
    speech.transcribe.mockReturnValue(errAsync(speechQuotaExceeded(new Error('status 401'))));
    const quota = new TranscribeSpeech(voiceDependencies({ speech }));

    expect((await broken.execute(recording))._unsafeUnwrapErr().code).toBe(
      'voice.rate_limiter_failed',
    );
    expect((await quota.execute(recording))._unsafeUnwrapErr().code).toBe('speech.quota_exceeded');
  });
});

import { describe, expect, it, vi } from 'vitest';

import { SPEECH_LIMITS } from '@modules/voice/application/contracts/voice-constraints';
import { TranscribeSpeech } from '@modules/voice/application/queries/transcribe-speech';

import { forbiddenError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import { speechQuotaExceeded } from '@lib/speech';

import { createBrokenRateLimiter } from '../../../support/rate-limiting';
import { denying, fakeSpeech, voiceDependencies } from '../fakes';

const ascii = (text: string): number[] => Array.from(text, (char) => char.charCodeAt(0));
const bytes = (...parts: number[][]): Uint8Array<ArrayBuffer> => new Uint8Array(parts.flat());

/** The start of a `MediaRecorder` WebM recording: the EBML header. */
const WEBM = bytes([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
const WAV = bytes(ascii('RIFF'), [0x24, 0, 0, 0], ascii('WAVEfmt '));

const recording = {
  childProfileId: 'child-1',
  audio: WEBM,
  contentType: 'audio/webm',
};

describe('TranscribeSpeech', () => {
  it('turns a German recording into text', async () => {
    const speech = fakeSpeech();
    const query = new TranscribeSpeech(voiceDependencies({ speech }));

    const result = await query.execute(recording);

    expect(result._unsafeUnwrap()).toEqual({ text: 'Was ist drei mal vier?' });
    expect(speech.transcribe).toHaveBeenCalledWith({
      audio: recording.audio,
      contentType: 'audio/webm',
      languageCode: 'deu',
    });
  });

  it('sends nothing to the provider without the parent consent on this child', async () => {
    const speech = fakeSpeech();
    const voiceConsentOf = vi.fn(() => okAsync(false));
    const query = new TranscribeSpeech(voiceDependencies({ speech, consent: { voiceConsentOf } }));

    const result = await query.execute(recording);

    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: 'forbidden',
      code: 'voice.consent_required',
    });
    expect(voiceConsentOf).toHaveBeenCalledWith('child-1');
    expect(speech.transcribe).not.toHaveBeenCalled();
  });

  it("refuses another parent's child and sends nothing", async () => {
    const speech = fakeSpeech();
    const foreign = forbiddenError('auth.permission_denied', 'Not yours.');
    const query = new TranscribeSpeech(
      voiceDependencies({ speech, consent: { voiceConsentOf: () => errAsync(foreign) } }),
    );

    expect((await query.execute(recording))._unsafeUnwrapErr()).toBe(foreign);
    expect(speech.transcribe).not.toHaveBeenCalled();
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

  it.each([
    ['audio/webm', WEBM],
    ['audio/ogg', bytes(ascii('OggS'), [0, 2])],
    ['audio/mp4', bytes([0, 0, 0, 0x20], ascii('ftypM4A '))],
    ['audio/mpeg', bytes(ascii('ID3'), [4, 0])],
    ['audio/mpeg', bytes([0xff, 0xfb, 0x90, 0x64])],
    ['audio/wav', WAV],
    ['audio/x-wav', WAV],
    ['audio/wave', WAV],
  ])('accepts %s with its format signature (%#)', async (contentType, audio) => {
    const speech = fakeSpeech();
    const query = new TranscribeSpeech(voiceDependencies({ speech }));

    expect((await query.execute({ ...recording, contentType, audio })).isOk()).toBe(true);
    expect(speech.transcribe).toHaveBeenCalledWith(expect.objectContaining({ contentType, audio }));
  });

  it.each([
    ['audio/webm', bytes([1, 2, 3])],
    ['audio/webm', bytes(ascii('OggS'), [0, 2])],
    ['audio/ogg', WEBM],
    ['audio/mp4', bytes(ascii('ftyp'), [0, 0, 0, 0])],
    ['audio/mpeg', bytes([0xff, 0xf1, 0x50, 0x80])],
    ['audio/wav', bytes(ascii('RIFF'), [0x24, 0, 0, 0], ascii('AVI '))],
  ])('refuses %s bytes without its format signature (%#)', async (contentType, audio) => {
    const speech = fakeSpeech();
    const query = new TranscribeSpeech(voiceDependencies({ speech }));

    const result = await query.execute({ ...recording, contentType, audio });

    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: 'validation',
      code: 'voice.validation_failed',
      fieldErrors: { audio: ['voice.validation.recording_content_mismatch'] },
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

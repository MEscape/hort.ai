import { describe, expect, it, vi } from 'vitest';

import type { TutorVoice } from '@modules/alexa/application/contracts/tutor-voice-model';
import { connectionTestTutor } from '@modules/alexa/infrastructure/connection-test/connection-test-tutor';
import { createAlexaEndpoint } from '@modules/alexa/presentation/routes';

import { infrastructureError } from '@lib/errors';
import { errAsync, okAsync, ResultAsync } from '@lib/result';

const SKILL_ID = 'amzn1.ask.skill.00000000-0000-0000-0000-000000000000';
const TEST_SENTENCE = 'Lennart wann holen wir uns draußen Suppe';
const CLIP_URL = 'https://clips.example/speech-clips/abc.mp3?sv=2025&sig=x';
/** What the simulator sends with the APL interface enabled; irrelevant for APL for Audio. */
const APL = { 'Alexa.Presentation.APL': { runtime: { maxVersion: '2024.3' } } };

function launch(supportedInterfaces?: Record<string, unknown>, type = 'LaunchRequest') {
  return new Request('https://hort.example/api/alexa', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      version: '1.0',
      context: {
        System: {
          application: { applicationId: SKILL_ID },
          ...(supportedInterfaces ? { device: { supportedInterfaces } } : {}),
        },
      },
      session: {
        sessionId: 'amzn1.echo-api.session.test',
        application: { applicationId: SKILL_ID },
      },
      request: {
        type,
        requestId: 'amzn1.echo-api.request.test',
        timestamp: new Date().toISOString(),
        locale: 'de-DE',
      },
    }),
  });
}

function voiceAnswering(url: string): TutorVoice & { audioUrl: ReturnType<typeof vi.fn> } {
  return { audioUrl: vi.fn(() => okAsync(url)) };
}

function endpoint(voice: TutorVoice | null, extra: { voiceDeadlineMs?: number } = {}) {
  const onVoiceFallback = vi.fn<(reason: string) => void>();
  const handle = createAlexaEndpoint({
    skillId: SKILL_ID,
    verify: () => okAsync(undefined),
    tutor: connectionTestTutor,
    voice,
    onVoiceFallback,
    ...extra,
  });
  return { handle, onVoiceFallback };
}

const PLAIN_TEST_SENTENCE = {
  version: '1.0',
  response: { outputSpeech: { type: 'PlainText', text: TEST_SENTENCE }, shouldEndSession: true },
};

describe('Alexa tutor voice', () => {
  it('answers the launch with an APL for Audio clip of the test sentence', async () => {
    const voice = voiceAnswering(CLIP_URL);
    const { handle, onVoiceFallback } = endpoint(voice);

    const response = await handle(launch(APL));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      version: '1.0',
      response: {
        directives: [
          {
            type: 'Alexa.Presentation.APLA.RenderDocument',
            token: 'tutor-voice',
            document: {
              type: 'APLA',
              version: '0.91',
              mainTemplate: { item: { type: 'Audio', source: CLIP_URL } },
            },
          },
        ],
        shouldEndSession: true,
      },
    });
    expect(voice.audioUrl).toHaveBeenCalledExactlyOnceWith(TEST_SENTENCE);
    expect(onVoiceFallback).not.toHaveBeenCalled();
  });

  it('needs no APL for Audio entry in supportedInterfaces (Alexa does not send one)', async () => {
    const { handle } = endpoint(voiceAnswering(CLIP_URL));

    const body = await (await handle(launch())).json();

    expect(body.response.directives[0].type).toBe('Alexa.Presentation.APLA.RenderDocument');
  });

  it('keeps the standard voice while no tutor voice is configured', async () => {
    const { handle } = endpoint(null);

    expect(await (await handle(launch(APL))).json()).toEqual(PLAIN_TEST_SENTENCE);
  });

  it('falls back to the standard voice and reports only the error code when the voice fails', async () => {
    const voice: TutorVoice = {
      audioUrl: () => errAsync(infrastructureError('speech.quota_exceeded', 'Quota used up.')),
    };
    const { handle, onVoiceFallback } = endpoint(voice);

    const response = await handle(launch(APL));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(PLAIN_TEST_SENTENCE);
    expect(onVoiceFallback).toHaveBeenCalledExactlyOnceWith('speech.quota_exceeded');
  });

  it('falls back to the standard voice when the voice misses the deadline', async () => {
    const hanging: TutorVoice = {
      audioUrl: () => new ResultAsync(new Promise(() => undefined)),
    };
    const { handle, onVoiceFallback } = endpoint(hanging, { voiceDeadlineMs: 30 });
    const started = performance.now();

    const response = await handle(launch(APL));

    expect(await response.json()).toEqual(PLAIN_TEST_SENTENCE);
    expect(performance.now() - started).toBeLessThan(1_000);
    expect(onVoiceFallback).toHaveBeenCalledExactlyOnceWith('timeout');
  });

  it('falls back to the standard voice when the voice adapter throws', async () => {
    const throwing: TutorVoice = {
      audioUrl: () => new ResultAsync(Promise.reject(new Error('boom'))),
    };
    const { handle, onVoiceFallback } = endpoint(throwing);

    expect(await (await handle(launch(APL))).json()).toEqual(PLAIN_TEST_SENTENCE);
    expect(onVoiceFallback).toHaveBeenCalledExactlyOnceWith('unexpected');
  });

  it('re-prompts in the standard voice when the tutor keeps the conversation open', async () => {
    const voice = voiceAnswering(CLIP_URL);
    const handle = createAlexaEndpoint({
      skillId: SKILL_ID,
      verify: () => okAsync(undefined),
      tutor: { respond: () => okAsync({ speech: 'Was ist drei mal vier?', conversation: 'open' }) },
      voice,
    });

    const body = await (await handle(launch(APL))).json();

    expect(body.response.directives[0].document.mainTemplate.item.source).toBe(CLIP_URL);
    expect(body.response.reprompt).toEqual({
      outputSpeech: { type: 'PlainText', text: 'Was ist drei mal vier?' },
    });
    expect(body.response.shouldEndSession).toBe(false);
    expect(body.response.outputSpeech).toBeUndefined();
  });

  it('speaks channel phrases and the tutor-failure apology in the standard voice', async () => {
    const voice = voiceAnswering(CLIP_URL);
    const handle = createAlexaEndpoint({
      skillId: SKILL_ID,
      verify: () => okAsync(undefined),
      tutor: { respond: () => errAsync(infrastructureError('tutor.down', 'Down.')) },
      voice,
    });

    const body = await (await handle(launch(APL))).json();

    expect(body.response.outputSpeech.type).toBe('PlainText');
    expect(voice.audioUrl).not.toHaveBeenCalled();
  });

  it('acknowledges an APL for Audio runtime error without speech and reports it', async () => {
    const { handle, onVoiceFallback } = endpoint(voiceAnswering(CLIP_URL));

    const response = await handle(launch(APL, 'Alexa.Presentation.APLA.RuntimeError'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: '1.0', response: {} });
    expect(onVoiceFallback).toHaveBeenCalledExactlyOnceWith('apla_runtime_error');
  });
});

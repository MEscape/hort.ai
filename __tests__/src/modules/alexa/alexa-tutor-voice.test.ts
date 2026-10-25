import { describe, expect, it, vi } from 'vitest';

import type { TutorVoice } from '@modules/alexa/application/contracts/tutor-voice-model';
import { toTutorId } from '@modules/alexa/domain/models/ids';
import { connectionTestTutor } from '@modules/alexa/infrastructure/connection-test/connection-test-tutor';
import { catalogTutorIntroductions } from '@modules/alexa/infrastructure/tutors/catalog-tutor-introductions';
import { createAlexaEndpoint } from '@modules/alexa/presentation/routes';
import { tutorCatalog } from '@modules/tutors';

import { infrastructureError } from '@lib/errors';
import { errAsync, ok, okAsync, ResultAsync } from '@lib/result';

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

function voiceAnswering(
  url: string,
): TutorVoice & { audioUrl: ReturnType<typeof vi.fn>; greetingUrl: ReturnType<typeof vi.fn> } {
  return { audioUrl: vi.fn(() => okAsync(url)), greetingUrl: vi.fn(() => okAsync(url)) };
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
  it('voices a tutor reply as an APL for Audio clip (launch without introductions)', async () => {
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
      greetingUrl: () => okAsync(CLIP_URL),
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
      greetingUrl: () => okAsync(CLIP_URL),
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
      greetingUrl: () => okAsync(CLIP_URL),
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

describe('Alexa tutor introductions on launch', () => {
  const INTROS = [
    { tutorId: toTutorId('max'), text: 'Wuff, hallo! Ich bin Max.' },
    { tutorId: toTutorId('lili'), text: 'Hallo, ich bin Lili.' },
    { tutorId: toTutorId('fina'), text: 'Hallo, ich bin Fina!' },
  ] as const;
  const clip = (id: string) => `https://clips.example/speech-clips/${id}.mp3?sig=x`;
  const ALL_PLAIN = {
    version: '1.0',
    response: {
      outputSpeech: { type: 'PlainText', text: INTROS.map((intro) => intro.text).join(' ') },
      shouldEndSession: true,
    },
  };

  function introEndpoint(
    greetingUrl: TutorVoice['greetingUrl'] | null,
    extra: { voiceDeadlineMs?: number } = {},
  ) {
    const onVoiceFallback = vi.fn<(reason: string) => void>();
    const audioUrl = vi.fn(() => okAsync(CLIP_URL));
    const tutorRespond = vi.fn(connectionTestTutor.respond);
    const handle = createAlexaEndpoint({
      skillId: SKILL_ID,
      verify: () => okAsync(undefined),
      tutor: { respond: tutorRespond },
      introductions: INTROS,
      voice: greetingUrl ? { audioUrl, greetingUrl } : null,
      onVoiceFallback,
      ...extra,
    });
    return { handle, onVoiceFallback, audioUrl, tutorRespond };
  }

  it('lets every tutor greet in its own voice, in catalog order, in one APLA sequencer', async () => {
    const greetingUrl = vi.fn((id: string) => okAsync(clip(id)));
    const { handle, onVoiceFallback, audioUrl, tutorRespond } = introEndpoint(greetingUrl);

    const response = await handle(launch());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      version: '1.0',
      response: {
        directives: [
          {
            type: 'Alexa.Presentation.APLA.RenderDocument',
            token: 'tutor-intros',
            document: {
              type: 'APLA',
              version: '0.91',
              mainTemplate: {
                item: {
                  type: 'Sequencer',
                  items: [
                    { type: 'Audio', source: clip('max') },
                    { type: 'Audio', source: clip('lili') },
                    { type: 'Audio', source: clip('fina') },
                  ],
                },
              },
            },
          },
        ],
        shouldEndSession: true,
      },
    });
    expect(greetingUrl.mock.calls.map(([id]) => id)).toEqual(['max', 'lili', 'fina']);
    expect(audioUrl).not.toHaveBeenCalled();
    expect(tutorRespond).not.toHaveBeenCalled();
    expect(onVoiceFallback).not.toHaveBeenCalled();
  });

  it('speaks only the failing greeting in the standard voice and keeps the others', async () => {
    const greetingUrl = (id: string) =>
      id === 'lili'
        ? errAsync(infrastructureError('speech.quota_exceeded', 'Quota used up.'))
        : okAsync(clip(id));
    const { handle, onVoiceFallback } = introEndpoint(greetingUrl);

    const body = await (await handle(launch())).json();

    expect(body.response.directives[0].document.mainTemplate.item.items).toEqual([
      { type: 'Audio', source: clip('max') },
      { type: 'Speech', content: INTROS[1].text },
      { type: 'Audio', source: clip('fina') },
    ]);
    expect(body.response.outputSpeech).toBeUndefined();
    expect(onVoiceFallback).toHaveBeenCalledExactlyOnceWith('speech.quota_exceeded');
  });

  it('fetches all clips in parallel under one deadline; a late one falls back alone', async () => {
    const greetingUrl = (id: string) =>
      id === 'fina'
        ? new ResultAsync<string, never>(
            new Promise(() => {
              /* never settles */
            }),
          )
        : new ResultAsync<string, never>(
            new Promise((resolve) =>
              setTimeout(() => {
                resolve(ok(clip(id)));
              }, 40),
            ),
          );
    const { handle, onVoiceFallback } = introEndpoint(greetingUrl, { voiceDeadlineMs: 100 });
    const started = performance.now();

    const body = await (await handle(launch())).json();

    // Sequential waiting would take 40 + 40 + 100 ms; parallel stays near the single deadline.
    expect(performance.now() - started).toBeLessThan(180);
    expect(body.response.directives[0].document.mainTemplate.item.items).toEqual([
      { type: 'Audio', source: clip('max') },
      { type: 'Audio', source: clip('lili') },
      { type: 'Speech', content: INTROS[2].text },
    ]);
    expect(onVoiceFallback).toHaveBeenCalledExactlyOnceWith('timeout');
  });

  it('falls back to plain text when no greeting clip is available', async () => {
    const { handle, onVoiceFallback } = introEndpoint(
      () => new ResultAsync(Promise.reject(new Error('boom'))),
    );

    expect(await (await handle(launch())).json()).toEqual(ALL_PLAIN);
    expect(onVoiceFallback).toHaveBeenCalledTimes(INTROS.length);
  });

  it('greets in plain text with the voice switched off', async () => {
    const { handle, tutorRespond } = introEndpoint(null);

    expect(await (await handle(launch())).json()).toEqual(ALL_PLAIN);
    expect(tutorRespond).not.toHaveBeenCalled();
  });

  it('reads the greetings of all ready tutors from the catalog, in catalog order', () => {
    const ready = tutorCatalog.tutoren.filter((tutor) => tutor.status === 'bereit');

    expect(catalogTutorIntroductions()).toEqual(
      ready.map((tutor) => ({ tutorId: tutor.id, text: tutor.begruessung })),
    );
    expect(catalogTutorIntroductions().map((intro) => intro.tutorId)).toEqual([
      'max',
      'lili',
      'fina',
    ]);
    const drafts = ready.map((tutor) => ({
      ...tutor,
      id: `${tutor.id}-neu`,
      status: 'entwurf' as const,
    }));
    expect(
      catalogTutorIntroductions({ ...tutorCatalog, tutoren: [...drafts, ...ready] }).map(
        (intro) => intro.tutorId,
      ),
    ).toEqual(['max', 'lili', 'fina']);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  TutorConversation,
  TutorTurn,
} from '@modules/alexa/application/contracts/tutor-conversation-model';
import {
  createAskRequestVerifier,
  verifyAlexaRequest,
} from '@modules/alexa/infrastructure/ask-sdk/ask-request-verifier';
import {
  CONNECTION_TEST_SENTENCE,
  connectionTestTutor,
} from '@modules/alexa/infrastructure/connection-test/connection-test-tutor';
import { createAlexaEndpoint } from '@modules/alexa/presentation/routes';

import { infrastructureError, unauthorizedError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const SKILL_ID = 'amzn1.ask.skill.00000000-0000-0000-0000-000000000000';
const OTHER_SKILL_ID = 'amzn1.ask.skill.11111111-1111-1111-1111-111111111111';
const TEST_SENTENCE = 'Lennart wann holen wir uns draußen Suppe';
const SESSION_ID = 'amzn1.echo-api.session.test';

interface EnvelopeOptions {
  skillId?: string;
  intent?: string;
  slots?: Record<string, { value?: string }>;
  timestamp?: string;
}

function envelope(type: string, options: EnvelopeOptions = {}) {
  const skillId = options.skillId ?? SKILL_ID;
  return JSON.stringify({
    version: '1.0',
    context: { System: { application: { applicationId: skillId } } },
    session: { sessionId: SESSION_ID, application: { applicationId: skillId } },
    request: {
      type,
      requestId: 'amzn1.echo-api.request.test',
      timestamp: options.timestamp ?? new Date().toISOString(),
      locale: 'de-DE',
      ...(options.intent ? { intent: { name: options.intent, slots: options.slots } } : {}),
    },
  });
}

function post(body: string, headers: Record<string, string> = {}) {
  return new Request('https://hort.example/api/alexa', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
    body,
  });
}

const acceptAll = () => okAsync(undefined);

function recordingTutor(conversation: 'open' | 'closed' = 'open') {
  const turns: TutorTurn[] = [];
  const tutor: TutorConversation = {
    respond: (turn) => {
      turns.push(turn);
      return okAsync({ speech: `Echo: ${turn.utterance ?? 'start'}`, conversation });
    },
  };
  return { tutor, turns };
}

describe('Alexa endpoint with the connection-test stub', () => {
  const handle = createAlexaEndpoint({
    skillId: SKILL_ID,
    verify: acceptAll,
    tutor: connectionTestTutor,
  });

  it('answers a LaunchRequest with the exact test sentence in the standard voice', async () => {
    expect(CONNECTION_TEST_SENTENCE).toBe(TEST_SENTENCE);

    const response = await handle(post(envelope('LaunchRequest')));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      version: '1.0',
      response: {
        outputSpeech: { type: 'PlainText', text: TEST_SENTENCE },
        shouldEndSession: true,
      },
    });
  });

  it.each(['AMAZON.StopIntent', 'AMAZON.CancelIntent', 'AMAZON.NavigateHomeIntent'])(
    'ends the session briefly on %s',
    async (intent) => {
      const response = await handle(post(envelope('IntentRequest', { intent })));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.response.outputSpeech).toEqual({ type: 'PlainText', text: 'Tschüss' });
      expect(body.response.shouldEndSession).toBe(true);
    },
  );

  it('gives a spoken help prompt and keeps listening on AMAZON.HelpIntent', async () => {
    const response = await handle(post(envelope('IntentRequest', { intent: 'AMAZON.HelpIntent' })));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.response.outputSpeech.type).toBe('PlainText');
    expect(body.response.reprompt.outputSpeech.type).toBe('PlainText');
    expect(body.response.shouldEndSession).toBe(false);
  });

  it('acknowledges SessionEndedRequest without speech', async () => {
    const response = await handle(post(envelope('SessionEndedRequest')));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: '1.0', response: {} });
  });

  it('rejects unknown request types without speaking', async () => {
    const response = await handle(post(envelope('CanFulfillIntentRequest')));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: 'invalid_envelope' } });
  });

  it('rejects malformed JSON bodies', async () => {
    const response = await handle(post('{not json'));

    expect(response.status).toBe(400);
  });

  it('rejects requests for a different skill id', async () => {
    const response = await handle(post(envelope('LaunchRequest', { skillId: OTHER_SKILL_ID })));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { code: 'wrong_skill' } });
  });

  it('is disabled (503) while no skill id is configured', async () => {
    const unconfigured = createAlexaEndpoint({
      skillId: undefined,
      verify: acceptAll,
      tutor: connectionTestTutor,
    });

    expect((await unconfigured(post(envelope('LaunchRequest')))).status).toBe(503);
  });

  it('rejects the request when signature verification fails', async () => {
    const rejecting = createAlexaEndpoint({
      skillId: SKILL_ID,
      verify: () => errAsync(unauthorizedError('alexa.request_rejected', 'bad signature')),
      tutor: connectionTestTutor,
    });

    const response = await rejecting(post(envelope('LaunchRequest')));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: 'invalid_alexa_request' } });
  });

  it('rejects non-JSON content types before verification', async () => {
    const verify = vi.fn(acceptAll);
    const guarded = createAlexaEndpoint({ skillId: SKILL_ID, verify, tutor: connectionTestTutor });

    const response = await guarded(
      new Request('https://hort.example/api/alexa', { method: 'POST', body: 'x' }),
    );

    expect(response.status).toBe(415);
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects oversized bodies', async () => {
    const response = await handle(post('x'.repeat(25 * 1024)));

    expect(response.status).toBe(413);
  });
});

describe('Alexa endpoint as a channel onto the tutor port', () => {
  it('opens the conversation without words and keeps listening when the tutor asks', async () => {
    const { tutor, turns } = recordingTutor('open');
    const handle = createAlexaEndpoint({ skillId: SKILL_ID, verify: acceptAll, tutor });

    const body = await (await handle(post(envelope('LaunchRequest')))).json();

    expect(turns).toEqual([{ conversationId: SESSION_ID, utterance: null, locale: 'de-DE' }]);
    expect(body.response).toEqual({
      outputSpeech: { type: 'PlainText', text: 'Echo: start' },
      reprompt: { outputSpeech: { type: 'PlainText', text: 'Echo: start' } },
      shouldEndSession: false,
    });
  });

  it('passes the free text of the child to the tutor', async () => {
    const { tutor, turns } = recordingTutor('closed');
    const handle = createAlexaEndpoint({ skillId: SKILL_ID, verify: acceptAll, tutor });

    const response = await handle(
      post(
        envelope('IntentRequest', {
          intent: 'FreieEingabeIntent',
          slots: { eingabe: { value: '  neun  ' } },
        }),
      ),
    );
    const body = await response.json();

    expect(turns).toEqual([{ conversationId: SESSION_ID, utterance: 'neun', locale: 'de-DE' }]);
    expect(body.response.outputSpeech.text).toBe('Echo: neun');
    expect(body.response.shouldEndSession).toBe(true);
  });

  it.each([
    ['AMAZON.FallbackIntent', undefined],
    ['FreieEingabeIntent', {}],
    ['FreieEingabeIntent', { eingabe: { value: '   ' } }],
  ])('asks again without calling the tutor for %s with %j', async (intent, slots) => {
    const { tutor, turns } = recordingTutor();
    const handle = createAlexaEndpoint({ skillId: SKILL_ID, verify: acceptAll, tutor });

    const body = await (
      await handle(post(envelope('IntentRequest', { intent, ...(slots ? { slots } : {}) })))
    ).json();

    expect(turns).toEqual([]);
    expect(body.response.shouldEndSession).toBe(false);
  });

  it('rejects a request whose session id cannot name a conversation', async () => {
    const { tutor, turns } = recordingTutor();
    const handle = createAlexaEndpoint({ skillId: SKILL_ID, verify: acceptAll, tutor });
    const body = envelope('LaunchRequest').replace(SESSION_ID, '');

    const response = await handle(post(body));

    expect(response.status).toBe(400);
    expect(turns).toEqual([]);
  });

  it('apologises and ends the session when the tutor fails', async () => {
    const failing: TutorConversation = {
      respond: () => errAsync(infrastructureError('tutor.unavailable', 'down')),
    };
    const handle = createAlexaEndpoint({ skillId: SKILL_ID, verify: acceptAll, tutor: failing });

    const response = await handle(post(envelope('LaunchRequest')));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.response.outputSpeech.type).toBe('PlainText');
    expect(body.response.shouldEndSession).toBe(true);
  });
});

describe('verifyAlexaRequest (official ASK SDK verifiers)', () => {
  it('rejects a request without signature headers', async () => {
    const result = await verifyAlexaRequest(envelope('LaunchRequest'), {
      'content-type': 'application/json',
    });

    expect(result.isErr()).toBe(true);
  });

  it('rejects a request whose certificate URL is not an Amazon Alexa URL', async () => {
    const result = await verifyAlexaRequest(envelope('LaunchRequest'), {
      signaturecertchainurl: 'https://evil.example.com/echo.api/echo-api-cert.pem',
      signature: 'aW52YWxpZA==',
      'signature-256': 'aW52YWxpZA==',
    });

    expect(result.isErr()).toBe(true);
  });

  it('rejects a body that is not JSON', async () => {
    const result = await verifyAlexaRequest('{not json', {});

    expect(result.isErr()).toBe(true);
  });
});

describe('createAskRequestVerifier guards in front of the ASK SDK', () => {
  const NOW = Date.parse('2026-10-24T18:00:00.000Z');
  const CERT_URL = 'https://s3.amazonaws.com/echo.api/echo-api-cert-EUAmazon-prod-30584302.pem';

  function setup(signatureOutcome: () => Promise<void> = () => Promise.resolve()) {
    const clock = { now: NOW };
    const signature = { verify: vi.fn(signatureOutcome) };
    const timestamp = { verify: vi.fn(() => Promise.resolve()) };
    const verify = createAskRequestVerifier({ signature, timestamp, now: () => clock.now });
    return { clock, signature, timestamp, verify };
  }
  const signedAt = (offsetMs: number) =>
    envelope('LaunchRequest', { timestamp: new Date(NOW + offsetMs).toISOString() });
  const headers = (url = CERT_URL) => ({ signaturecertchainurl: url, 'signature-256': 'c2ln' });

  it.each([
    ['exactly 150 s old', -150_000, true],
    ['exactly 150 s ahead', 150_000, true],
    ['151 s old', -151_000, false],
    ['151 s ahead', 151_000, false],
    ['ten minutes old', -600_000, false],
  ])('treats a timestamp %s as in window: %s', async (_label, offset, accepted) => {
    const { signature, timestamp, verify } = setup();

    const result = await verify(signedAt(offset), headers());

    expect(result.isOk()).toBe(accepted);
    expect(timestamp.verify).toHaveBeenCalledTimes(accepted ? 1 : 0);
    expect(signature.verify).toHaveBeenCalledTimes(accepted ? 1 : 0);
  });

  it.each([
    ['a query string', `${CERT_URL}?nonce=1`],
    ['a fragment', `${CERT_URL}#x`],
    ['an explicit port', CERT_URL.replace('.com/', '.com:443/')],
    ['upper-case host', CERT_URL.replace('s3.', 'S3.')],
    ['dot segments', CERT_URL.replace('/echo.api/', '/echo.api/../echo.api/')],
    ['an encoded character', CERT_URL.replace('prod', 'pr%6Fd')],
    ['another file name', 'https://s3.amazonaws.com/echo.api/anything.pem'],
    ['another host', CERT_URL.replace('s3.amazonaws.com', 'evil.example.com')],
  ])('rejects a certificate URL with %s without reaching the SDK', async (_label, url) => {
    const { signature, verify } = setup();

    const result = await verify(signedAt(0), headers(url));

    expect(result.isErr()).toBe(true);
    expect(signature.verify).not.toHaveBeenCalled();
  });

  it('limits downloads of unknown certificate URLs to five per ten minutes', async () => {
    const { clock, signature, verify } = setup(() => Promise.reject(new Error('bad signature')));
    const attempt = (n: number) =>
      verify(signedAt(0), headers(`https://s3.amazonaws.com/echo.api/echo-api-cert-${n}.pem`));

    for (let n = 1; n <= 7; n += 1) {
      await attempt(n);
    }
    expect(signature.verify).toHaveBeenCalledTimes(5);

    clock.now += 10 * 60_000;
    await verify(
      envelope('LaunchRequest', { timestamp: new Date(clock.now).toISOString() }),
      headers('https://s3.amazonaws.com/echo.api/echo-api-cert-8.pem'),
    );
    expect(signature.verify).toHaveBeenCalledTimes(6);
  });

  it('downloads an unknown certificate URL only one at a time', async () => {
    let release: () => void = () => undefined;
    const { signature, verify } = setup(() => new Promise<void>((resolve) => (release = resolve)));

    const first = verify(signedAt(0), headers());
    const second = await verify(signedAt(0), headers());
    release();

    expect(second.isErr()).toBe(true);
    expect((await first).isOk()).toBe(true);
    expect(signature.verify).toHaveBeenCalledTimes(1);
  });

  it.each([
    'https://s3.amazonaws.com/echo.api/echo-api-cert-EUAmazon-prod-30584302.pem',
    'https://s3.amazonaws.com/echo.api/echo-api-cert-12.pem',
    'https://s3.amazonaws.com/echo.api/echo-api-cert.pem',
  ])('accepts the Amazon certificate URL %s', async (url) => {
    const { signature, verify } = setup();

    expect((await verify(signedAt(0), headers(url))).isOk()).toBe(true);
    expect(signature.verify).toHaveBeenCalledTimes(1);
  });

  it('keeps a verified certificate URL free of the download budget', async () => {
    const { signature, verify } = setup();

    for (let n = 0; n < 10; n += 1) {
      expect((await verify(signedAt(0), headers())).isOk()).toBe(true);
    }
    expect(signature.verify).toHaveBeenCalledTimes(10);
  });
});

describe('POST /api/alexa route wiring', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('rejects an unsigned request with the real verifiers', async () => {
    vi.stubEnv('ALEXA_SKILL_ID', SKILL_ID);
    vi.resetModules();
    const { POST } = await import('@/app/api/alexa/route');

    const response = await POST(post(envelope('LaunchRequest')));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: 'invalid_alexa_request' } });
  });
});

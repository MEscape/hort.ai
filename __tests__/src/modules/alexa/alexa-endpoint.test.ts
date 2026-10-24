import { SkillRequestSignatureVerifier } from 'ask-sdk-express-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  TutorConversation,
  TutorTurn,
} from '@modules/alexa/application/contracts/tutor-conversation-model';
import {
  createAlexaRequestVerifier,
  verifyAlexaRequest,
} from '@modules/alexa/infrastructure/ask-sdk/ask-request-verifier';
import {
  CONNECTION_TEST_SENTENCE,
  connectionTestTutor,
} from '@modules/alexa/infrastructure/connection-test/connection-test-tutor';
import { createAlexaEndpoint } from '@modules/alexa/presentation/routes';

import { infrastructureError, unauthorizedError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import type { IncomingHttpHeaders } from 'node:http';

const SKILL_ID = 'amzn1.ask.skill.00000000-0000-0000-0000-000000000000';
const OTHER_SKILL_ID = 'amzn1.ask.skill.11111111-1111-1111-1111-111111111111';
const TEST_SENTENCE = 'Lennart wann holen wir uns draußen Suppe';
const SESSION_ID = 'amzn1.echo-api.session.test';
/** The form of URL Amazon sends in SignatureCertChainUrl. */
const CERT_URL = 'https://s3.amazonaws.com/echo.api/echo-api-cert-12.pem';

/** The SDK's private download step, spied on to prove when a certificate would be fetched. */
interface CertDownloader {
  _getCertChainByUrl: (url: string) => Promise<string>;
}

function signed(certUrl: string): IncomingHttpHeaders {
  return { signaturecertchainurl: certUrl, signature: 'c2ln', 'signature-256': 'c2ln' };
}

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

  it('downloads a canonical certificate URL once and never a non-canonical one', async () => {
    const download = vi
      .spyOn(
        SkillRequestSignatureVerifier.prototype as unknown as CertDownloader,
        '_getCertChainByUrl',
      )
      .mockRejectedValue(new Error('offline'));
    const verify = createAlexaRequestVerifier();
    try {
      const rejected = await verify(envelope('LaunchRequest'), signed(`${CERT_URL}?v=1`));
      expect(rejected.isErr()).toBe(true);
      expect(download).not.toHaveBeenCalled();

      const attempted = await verify(envelope('LaunchRequest'), signed(CERT_URL));
      expect(attempted.isErr()).toBe(true);
      expect(download).toHaveBeenCalledExactlyOnceWith(CERT_URL);
    } finally {
      download.mockRestore();
    }
  });
});

describe('verifyAlexaRequest guards before the signature verifier', () => {
  const NOW = Date.parse('2026-10-24T12:00:00.000Z');
  const TOLERANCE_MS = 150_000;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function observed(outcome: 'accept' | 'reject' = 'accept') {
    const verify = vi.fn((_raw: string, _headers: IncomingHttpHeaders) =>
      outcome === 'accept' ? Promise.resolve() : Promise.reject(new Error('bad signature')),
    );
    return { verify };
  }

  function at(offsetMs: number) {
    return envelope('LaunchRequest', { timestamp: new Date(NOW + offsetMs).toISOString() });
  }

  it.each([
    ['exactly 150 s old', -TOLERANCE_MS],
    ['exactly 150 s ahead', TOLERANCE_MS],
    ['current', 0],
  ])('verifies the signature of a %s request', async (_label, offset) => {
    const signatureVerifier = observed();
    const verify = createAlexaRequestVerifier({ signatureVerifier });

    const result = await verify(at(offset), signed(CERT_URL));

    expect(result.isOk()).toBe(true);
    expect(signatureVerifier.verify).toHaveBeenCalledOnce();
  });

  it.each([
    ['1 ms older than the window', -TOLERANCE_MS - 1],
    ['1 ms further ahead than the window', TOLERANCE_MS + 1],
    ['10 min in the past', -600_000],
    ['10 min in the future', 600_000],
  ])('rejects a timestamp %s without a certificate download', async (_label, offset) => {
    const signatureVerifier = observed();
    const verify = createAlexaRequestVerifier({ signatureVerifier });

    const result = await verify(at(offset), signed(CERT_URL));

    expect(result._unsafeUnwrapErr().code).toBe('alexa.request_rejected');
    expect(signatureVerifier.verify).not.toHaveBeenCalled();
  });

  it('rejects a missing or unparseable timestamp without a certificate download', async () => {
    const signatureVerifier = observed();
    const verify = createAlexaRequestVerifier({ signatureVerifier });

    const missing = JSON.stringify({ version: '1.0', request: { type: 'LaunchRequest' } });
    expect((await verify(missing, signed(CERT_URL))).isErr()).toBe(true);
    const garbled = envelope('LaunchRequest', { timestamp: 'yesterday' });
    expect((await verify(garbled, signed(CERT_URL))).isErr()).toBe(true);
    expect(signatureVerifier.verify).not.toHaveBeenCalled();
  });

  it.each([
    ['a query string', `${CERT_URL}?nonce=1`],
    ['an empty query', `${CERT_URL}?`],
    ['a fragment', `${CERT_URL}#x`],
    ['a non-default port', 'https://s3.amazonaws.com:8443/echo.api/echo-api-cert-12.pem'],
    ['plain http', 'http://s3.amazonaws.com/echo.api/echo-api-cert-12.pem'],
    ['credentials', 'https://user@s3.amazonaws.com/echo.api/echo-api-cert-12.pem'],
    ['another host', 'https://s3.amazonaws.com.evil.example/echo.api/echo-api-cert-12.pem'],
    ['another bucket path', 'https://s3.amazonaws.com/other/echo-api-cert-12.pem'],
    ['a nested path', 'https://s3.amazonaws.com/echo.api/sub/echo-api-cert-12.pem'],
    ['a traversal out of /echo.api/', 'https://s3.amazonaws.com/echo.api/../other/cert.pem'],
    ['percent-encoding', 'https://s3.amazonaws.com/echo.api/%2e%2e/cert.pem'],
    ['a non-PEM file', 'https://s3.amazonaws.com/echo.api/echo-api-cert-12.txt'],
    ['no URL', 'not a url'],
  ])('rejects a certificate URL with %s without calling the verifier', async (_label, url) => {
    const signatureVerifier = observed();
    const verify = createAlexaRequestVerifier({ signatureVerifier });

    const result = await verify(at(0), signed(url));

    expect(result.isErr()).toBe(true);
    expect(signatureVerifier.verify).not.toHaveBeenCalled();
  });

  it('rejects a missing or duplicated certificate URL header without calling the verifier', async () => {
    const signatureVerifier = observed();
    const verify = createAlexaRequestVerifier({ signatureVerifier });

    expect((await verify(at(0), { signature: 'c2ln' })).isErr()).toBe(true);
    expect(
      (await verify(at(0), { ...signed(CERT_URL), SignatureCertChainUrl: CERT_URL })).isErr(),
    ).toBe(true);
    expect(signatureVerifier.verify).not.toHaveBeenCalled();
  });

  it.each([
    ['the default port', 'https://s3.amazonaws.com:443/echo.api/echo-api-cert-12.pem'],
    ['an upper-case host', 'https://S3.AmazonAWS.com/echo.api/echo-api-cert-12.pem'],
  ])('hands the SDK the canonical URL for %s', async (_label, url) => {
    const signatureVerifier = observed();
    const verify = createAlexaRequestVerifier({ signatureVerifier });

    expect((await verify(at(0), signed(url))).isOk()).toBe(true);
    expect(signatureVerifier.verify).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signaturecertchainurl: CERT_URL }),
    );
  });

  it('caps downloads of unverified certificate URLs per window', async () => {
    const signatureVerifier = observed('reject');
    const verify = createAlexaRequestVerifier({
      signatureVerifier,
      downloadBudget: { max: 2, windowMs: 60_000 },
    });
    const certUrl = (n: number) => `https://s3.amazonaws.com/echo.api/echo-api-cert-${n}.pem`;

    for (const n of [1, 2, 3, 4]) {
      expect((await verify(at(0), signed(certUrl(n)))).isErr()).toBe(true);
    }
    expect(signatureVerifier.verify).toHaveBeenCalledTimes(2);

    vi.setSystemTime(NOW + 60_000);
    expect((await verify(at(0), signed(certUrl(5)))).isErr()).toBe(true);
    expect(signatureVerifier.verify).toHaveBeenCalledTimes(3);
  });

  it('keeps accepting an already verified certificate URL when the budget is spent', async () => {
    const signatureVerifier = {
      verify: vi.fn(async (_raw: string, headers: IncomingHttpHeaders) => {
        if (headers['signaturecertchainurl'] !== CERT_URL) {
          throw new Error('bad signature');
        }
      }),
    };
    const verify = createAlexaRequestVerifier({
      signatureVerifier,
      downloadBudget: { max: 2, windowMs: 60_000 },
    });

    expect((await verify(at(0), signed(CERT_URL))).isOk()).toBe(true);
    await verify(at(0), signed('https://s3.amazonaws.com/echo.api/forged-1.pem'));
    expect(
      (await verify(at(0), signed('https://s3.amazonaws.com/echo.api/forged-2.pem'))).isErr(),
    ).toBe(true);

    expect((await verify(at(0), signed(CERT_URL))).isOk()).toBe(true);
    expect(signatureVerifier.verify).toHaveBeenCalledTimes(3);
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

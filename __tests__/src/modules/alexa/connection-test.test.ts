import { afterEach, describe, expect, it, vi } from 'vitest';

import { verifyAlexaRequest } from '@modules/alexa/infrastructure/ask-sdk/ask-request-verifier';
import { CONNECTION_TEST_SENTENCE, createConnectionTest } from '@modules/alexa/presentation/routes';

import { unauthorizedError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const SKILL_ID = 'amzn1.ask.skill.00000000-0000-0000-0000-000000000000';
const OTHER_SKILL_ID = 'amzn1.ask.skill.11111111-1111-1111-1111-111111111111';
const TEST_SENTENCE = 'ahoi aura ai wäre auch gut gewesen';

function envelope(
  type: string,
  options: { skillId?: string; intent?: string; timestamp?: string } = {},
) {
  const skillId = options.skillId ?? SKILL_ID;
  return JSON.stringify({
    version: '1.0',
    context: { System: { application: { applicationId: skillId } } },
    session: { application: { applicationId: skillId } },
    request: {
      type,
      timestamp: options.timestamp ?? new Date().toISOString(),
      locale: 'de-DE',
      ...(options.intent ? { intent: { name: options.intent } } : {}),
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

describe('Alexa connection test handler', () => {
  const handle = createConnectionTest({ skillId: SKILL_ID, verify: acceptAll });

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

  it.each(['AMAZON.StopIntent', 'AMAZON.CancelIntent'])(
    'ends the session briefly on %s',
    async (intent) => {
      const response = await handle(post(envelope('IntentRequest', { intent })));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.response.outputSpeech).toEqual({ type: 'PlainText', text: 'Tschüss' });
      expect(body.response.shouldEndSession).toBe(true);
    },
  );

  it('gives a minimal spoken answer to AMAZON.HelpIntent', async () => {
    const response = await handle(post(envelope('IntentRequest', { intent: 'AMAZON.HelpIntent' })));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.response.outputSpeech.type).toBe('PlainText');
    expect(body.response.shouldEndSession).toBe(true);
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
    const unconfigured = createConnectionTest({ skillId: undefined, verify: acceptAll });

    expect((await unconfigured(post(envelope('LaunchRequest')))).status).toBe(503);
  });

  it('rejects the request when signature verification fails', async () => {
    const rejecting = createConnectionTest({
      skillId: SKILL_ID,
      verify: () => errAsync(unauthorizedError('alexa.request_rejected', 'bad signature')),
    });

    const response = await rejecting(post(envelope('LaunchRequest')));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: { code: 'invalid_alexa_request' } });
  });

  it('rejects non-JSON content types before verification', async () => {
    const verify = vi.fn(acceptAll);
    const guarded = createConnectionTest({ skillId: SKILL_ID, verify });

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

  it('rejects a stale timestamp before any certificate download', async () => {
    const stale = new Date(Date.now() - 10 * 60_000).toISOString();

    const result = await verifyAlexaRequest(envelope('LaunchRequest', { timestamp: stale }), {});

    expect(result._unsafeUnwrapErr().code).toBe('alexa.request_rejected');
  });

  it('rejects a body that is not JSON', async () => {
    const result = await verifyAlexaRequest('{not json', {});

    expect(result.isErr()).toBe(true);
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

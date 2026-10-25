// @vitest-environment node
import { createServer, type RequestListener, type Server } from 'node:http';

import { SkillRequestSignatureVerifier, TimestampVerifier } from 'ask-sdk-express-adapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAskRequestVerifier,
  withCertDownload,
} from '@modules/alexa/infrastructure/ask-sdk/ask-request-verifier';
import { downloadCertChain } from '@modules/alexa/infrastructure/ask-sdk/cert-chain-download';
import { connectionTestTutor } from '@modules/alexa/infrastructure/connection-test/connection-test-tutor';
import { createAlexaEndpoint } from '@modules/alexa/presentation/routes';

import { okAsync } from '@lib/result';

import { createTestCertificateChain, forge } from './ask-test-certificates';

import type { AddressInfo, Socket } from 'node:net';

const SKILL_ID = 'amzn1.ask.skill.00000000-0000-0000-0000-000000000000';
const OTHER_SKILL_ID = 'amzn1.ask.skill.11111111-1111-1111-1111-111111111111';
const CERT_URL = 'https://s3.amazonaws.com/echo.api/echo-api-cert-test.pem';
const SHORT_TIMEOUT_MS = 50;

const servers: Server[] = [];

/** A local server whose handler decides per request; returns its URL and every socket it accepted. */
async function serve(handler: RequestListener) {
  const sockets: Socket[] = [];
  const server = createServer(handler);
  servers.push(server);
  server.on('connection', (socket) => {
    sockets.push(socket);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/echo-api-cert.pem`, sockets };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => {
            resolve();
          });
        }),
    ),
  );
});

describe('downloadCertChain', () => {
  it('aborts a download whose server never answers and closes the connection', async () => {
    const stalled = await serve(() => undefined);
    const started = Date.now();

    const result = await downloadCertChain(stalled.url, { timeoutMs: SHORT_TIMEOUT_MS });

    expect(result._unsafeUnwrapErr().code).toBe('alexa.certificate_download_failed');
    expect(Date.now() - started).toBeLessThan(2_000);
    await vi.waitFor(() => {
      expect(stalled.sockets.length).toBeGreaterThan(0);
      expect(stalled.sockets.every((socket) => socket.destroyed)).toBe(true);
    });
  });

  it('aborts a body that trickles past the deadline', async () => {
    const trickling = await serve((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/x-pem-file' });
      response.write('-----BEGIN CERTIFICATE-----\n');
    });

    const result = await downloadCertChain(trickling.url, { timeoutMs: SHORT_TIMEOUT_MS });

    expect(result.isErr()).toBe(true);
  });

  it('returns the chain of a 200 response', async () => {
    const ok = await serve((_request, response) => {
      response.end('PEM');
    });

    expect((await downloadCertChain(ok.url))._unsafeUnwrap()).toBe('PEM');
  });

  it.each([
    ['a non-200 status', 404, 'x'],
    ['an oversized body', 200, 'x'.repeat(65 * 1024)],
  ])('rejects %s', async (_label, status, body) => {
    const bad = await serve((_request, response) => {
      response.writeHead(status);
      response.end(body);
    });

    expect((await downloadCertChain(bad.url)).isErr()).toBe(true);
  });
});

describe('official ASK SDK verifiers with a test certificate chain', () => {
  const chain = createTestCertificateChain();

  beforeEach(() => {
    // The SDK trusts only Node's root CAs; add the throw-away CA to the store it builds, nothing else changes.
    const createCaStore = forge.pki.createCaStore.bind(forge.pki);
    vi.spyOn(forge.pki, 'createCaStore').mockImplementation((certificates) => {
      const store = createCaStore(certificates);
      store.addCertificate(chain.caPem);
      return store;
    });
  });

  const serveChain = () => okAsync(chain.chainPem);

  function verifierWith(download: Parameters<typeof withCertDownload>[1]) {
    return createAskRequestVerifier({
      signature: withCertDownload(new SkillRequestSignatureVerifier(), download),
      timestamp: new TimestampVerifier(150_000),
      now: () => Date.now(),
    });
  }

  function envelope(contextSkill = SKILL_ID, sessionSkill = SKILL_ID) {
    return JSON.stringify({
      version: '1.0',
      context: { System: { application: { applicationId: contextSkill } } },
      session: {
        sessionId: 'amzn1.echo-api.session.test',
        application: { applicationId: sessionSkill },
      },
      request: {
        type: 'LaunchRequest',
        requestId: 'amzn1.echo-api.request.test',
        timestamp: new Date().toISOString(),
        locale: 'de-DE',
      },
    });
  }

  const signedHeaders = (signedBody: string) => ({
    signaturecertchainurl: CERT_URL,
    'signature-256': chain.sign(signedBody),
  });

  function signedPost(body: string, signedBody = body) {
    return new Request('https://hort.example/api/alexa', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...signedHeaders(signedBody) },
      body,
    });
  }

  function endpointWith(download: Parameters<typeof withCertDownload>[1]) {
    return createAlexaEndpoint({
      skillId: SKILL_ID,
      verify: verifierWith(download),
      tutor: connectionTestTutor,
    });
  }

  it('still has the SDK download step this module bounds', () => {
    expect(Reflect.get(SkillRequestSignatureVerifier.prototype, '_getCertChainByUrl')).toBeTypeOf(
      'function',
    );
  });

  it('accepts a correctly signed request end to end', async () => {
    const download = vi.fn(serveChain);

    const response = await endpointWith(download)(signedPost(envelope()));

    expect(response.status).toBe(200);
    expect((await response.json()).response.outputSpeech.text).toBe(
      'Lennart wann holen wir uns draußen Suppe',
    );
    expect(download).toHaveBeenCalledExactlyOnceWith(CERT_URL);
  });

  it('rejects a body that differs from the signed one', async () => {
    const response = await endpointWith(serveChain)(
      signedPost(envelope(), envelope(OTHER_SKILL_ID, OTHER_SKILL_ID)),
    );

    expect(response.status).toBe(400);
  });

  it.each([
    ['context', OTHER_SKILL_ID, SKILL_ID],
    ['session', SKILL_ID, OTHER_SKILL_ID],
  ])(
    'rejects a validly signed request whose %s names another skill',
    async (_label, contextSkill, sessionSkill) => {
      const response = await endpointWith(serveChain)(
        signedPost(envelope(contextSkill, sessionSkill)),
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: { code: 'wrong_skill' } });
    },
  );

  it('frees the download slot after a stalled download times out', async () => {
    const fetchCert = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          if (fetchCert.mock.calls.length > 1) {
            resolve(new Response(chain.chainPem));
            return;
          }
          init.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        }),
    );
    const verify = verifierWith((url) =>
      downloadCertChain(url, { fetch: fetchCert, timeoutMs: SHORT_TIMEOUT_MS }),
    );

    const first = envelope();
    const stalled = await verify(first, signedHeaders(first));
    const second = envelope();
    const retried = await verify(second, signedHeaders(second));

    expect(stalled.isErr()).toBe(true);
    expect(retried.isOk()).toBe(true);
    expect(fetchCert).toHaveBeenCalledTimes(2);
  });

  it('never uses the SDK download without a deadline', async () => {
    const sdkDownload = vi.spyOn(
      SkillRequestSignatureVerifier.prototype as unknown as {
        _getCertChainByUrl: (url: string) => Promise<string>;
      },
      '_getCertChainByUrl',
    );
    const body = envelope();

    const result = await verifierWith(serveChain)(body, signedHeaders(body));

    expect(result.isOk()).toBe(true);
    expect(sdkDownload).not.toHaveBeenCalled();
  });
});

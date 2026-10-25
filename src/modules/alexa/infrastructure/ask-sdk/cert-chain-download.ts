import type { InfrastructureAppError } from '@lib/errors';
import { errAsync, fromThrowable, fromThrowableAsync, type AppResultAsync } from '@lib/result';

import { certificateDownloadFailed } from '../../domain/errors/alexa-errors';

/** Total time for one certificate download: connect, response headers and body. Alexa allows 8 s per request. */
const CERT_DOWNLOAD_TIMEOUT_MS = 3_000;
/** Amazon's signing-certificate chain is a few KiB; anything far larger is not one. Counted in bytes. */
const MAX_CERT_CHAIN_BYTES = 65_536;
const HTTP_OK = 200;

type CertFetch = (url: string, init: RequestInit) => Promise<Response>;

interface CertDownloadOptions {
  readonly fetch?: CertFetch;
  readonly timeoutMs?: number;
}

/**
 * Downloads a certificate chain under one fixed deadline and byte limit. When either is hit, the request itself is
 * aborted (socket closed, body read cancelled), not merely abandoned, so a stalled or endless server cannot hold
 * the caller, a connection or memory.
 */
export function downloadCertChain(
  url: string,
  options: CertDownloadOptions = {},
): AppResultAsync<string, InfrastructureAppError> {
  const { fetch: fetchCert = globalThis.fetch, timeoutMs = CERT_DOWNLOAD_TIMEOUT_MS } = options;
  const overLimit = new AbortController();
  const signal = AbortSignal.any([AbortSignal.timeout(timeoutMs), overLimit.signal]);
  return fromThrowableAsync(
    () => fetchCert(url, { signal, redirect: 'error', cache: 'no-store' }),
    (thrown) => certificateDownloadFailed('request failed or timed out', thrown),
  ).andThen((response) => readChain(response, overLimit));
}

function readChain(
  response: Response,
  overLimit: AbortController,
): AppResultAsync<string, InfrastructureAppError> {
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  // `!(x <= max)` also rejects a malformed (NaN) Content-Length.
  if (
    response.status !== HTTP_OK ||
    !(declaredLength <= MAX_CERT_CHAIN_BYTES) ||
    response.body === null
  ) {
    overLimit.abort();
    return errAsync(certificateDownloadFailed(`unusable response (status ${response.status})`));
  }
  const reader = response.body.getReader();
  return fromThrowableAsync(
    () => readBounded(reader),
    (thrown) => certificateDownloadFailed('body failed or timed out', thrown),
  ).andThen((body) => {
    if (body === undefined) {
      overLimit.abort();
      return errAsync(certificateDownloadFailed('certificate chain too large'));
    }
    return fromThrowable(
      () => new TextDecoder('utf-8', { fatal: true }).decode(body),
      (thrown) => certificateDownloadFailed('certificate chain is not UTF-8', thrown),
    );
  });
}

/**
 * Reads chunk by chunk; as soon as the byte count passes MAX_CERT_CHAIN_BYTES the reader is cancelled and
 * `undefined` returned, so an oversized body is never buffered.
 */
async function readBounded(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<Uint8Array | undefined> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > MAX_CERT_CHAIN_BYTES) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

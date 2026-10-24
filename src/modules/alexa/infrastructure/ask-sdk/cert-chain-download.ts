import type { InfrastructureAppError } from '@lib/errors';
import { errAsync, fromThrowableAsync, okAsync, type AppResultAsync } from '@lib/result';

import { certificateDownloadFailed } from '../../domain/errors/alexa-errors';

/** Total time for one certificate download: connect, response headers and body. Alexa allows 8 s per request. */
const CERT_DOWNLOAD_TIMEOUT_MS = 3_000;
/** Amazon's signing-certificate chain is a few KiB; anything far larger is not one. */
const MAX_CERT_CHAIN_BYTES = 65_536;
const HTTP_OK = 200;

type CertFetch = (url: string, init: RequestInit) => Promise<Response>;

interface CertDownloadOptions {
  readonly fetch?: CertFetch;
  readonly timeoutMs?: number;
}

/**
 * Downloads a certificate chain under one fixed deadline. When it passes, the request itself is aborted (socket
 * closed, body read cancelled), not merely abandoned, so a stalled server cannot hold the caller or a connection.
 */
export function downloadCertChain(
  url: string,
  options: CertDownloadOptions = {},
): AppResultAsync<string, InfrastructureAppError> {
  const { fetch: fetchCert = globalThis.fetch, timeoutMs = CERT_DOWNLOAD_TIMEOUT_MS } = options;
  const signal = AbortSignal.timeout(timeoutMs);
  return fromThrowableAsync(
    () => fetchCert(url, { signal, redirect: 'error', cache: 'no-store' }),
    (thrown) => certificateDownloadFailed('request failed or timed out', thrown),
  ).andThen(readChain);
}

function readChain(response: Response): AppResultAsync<string, InfrastructureAppError> {
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (response.status !== HTTP_OK || declaredLength > MAX_CERT_CHAIN_BYTES) {
    void response.body?.cancel();
    return errAsync(certificateDownloadFailed(`unusable response (status ${response.status})`));
  }
  return fromThrowableAsync(
    () => response.text(),
    (thrown) => certificateDownloadFailed('body failed or timed out', thrown),
  ).andThen((chain) =>
    chain.length > MAX_CERT_CHAIN_BYTES
      ? errAsync(certificateDownloadFailed('certificate chain too large'))
      : okAsync(chain),
  );
}

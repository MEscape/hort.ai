import { SkillRequestSignatureVerifier, TimestampVerifier } from 'ask-sdk-express-adapter';

import type { UnauthorizedAppError } from '@lib/errors';
import { errAsync, fromThrowable, fromThrowableAsync, type AppResultAsync } from '@lib/result';
import { MS_PER_MINUTE, parseJson } from '@lib/utils';

import { alexaRequestRejected } from '../../domain/errors/alexa-errors';

import type { IncomingHttpHeaders } from 'node:http';

const TOLERANCE_MS = 150_000;
const CERT_URL_HEADER = 'signaturecertchainurl';
/**
 * Amazon's signing-certificate URLs (e.g. `echo-api-cert-EUAmazon-prod-30584302.pem`), canonical only: no query,
 * fragment, port, host case variants or dot segments, so one certificate cannot be fetched under many cache keys.
 */
const CERT_URL =
  /^https:\/\/s3\.amazonaws\.com\/echo\.api\/echo-api-cert(?:-[A-Za-z0-9]{1,32}){0,4}\.pem$/;
/** Downloads for certificate URLs that have not verified a request yet: one at a time, few per window. */
const NEW_CERT_DOWNLOADS_PER_WINDOW = 5;
const NEW_CERT_WINDOW_MINUTES = 10;
const NEW_CERT_WINDOW_MS = NEW_CERT_WINDOW_MINUTES * MS_PER_MINUTE;
const KNOWN_CERT_URLS_MAX = 8;

interface SignatureVerifier {
  verify(raw: string, headers: IncomingHttpHeaders): Promise<void>;
}
interface RequestTimestampVerifier {
  verify(raw: string): Promise<void>;
}
interface AskVerifierDependencies {
  readonly signature: SignatureVerifier;
  readonly timestamp: RequestTimestampVerifier;
  readonly now: () => number;
}

/**
 * Official ASK verifiers behind cheap guards that run first: a symmetric, finite timestamp window (the SDK only
 * rejects old dates) and a per-instance budget for certificate downloads. The SDK caches a certificate per URL
 * once its chain is valid; a URL that has not verified a request yet costs a download, so such URLs must be
 * canonical, are fetched one at a time and at most NEW_CERT_DOWNLOADS_PER_WINDOW times per window.
 */
export function createAskRequestVerifier(deps: AskVerifierDependencies) {
  const knownCertUrls = new Set<string>();
  const downloadTimes: number[] = [];
  let downloading = false;

  const reserveDownload = (): boolean => {
    const now = deps.now();
    while (downloadTimes.length > 0 && now - (downloadTimes[0] ?? now) >= NEW_CERT_WINDOW_MS) {
      downloadTimes.shift();
    }
    if (downloading || downloadTimes.length >= NEW_CERT_DOWNLOADS_PER_WINDOW) {
      return false;
    }
    downloadTimes.push(now);
    downloading = true;
    return true;
  };

  return (
    raw: string,
    headers: IncomingHttpHeaders,
  ): AppResultAsync<void, UnauthorizedAppError> => {
    const parsed = fromThrowable(() => parseJson(raw), alexaRequestRejected);
    const timestamp = parsed.isOk() ? readTimestamp(parsed.value) : Number.NaN;
    if (!Number.isFinite(timestamp) || Math.abs(deps.now() - timestamp) > TOLERANCE_MS) {
      return errAsync(alexaRequestRejected());
    }
    const certUrl = readHeader(headers, CERT_URL_HEADER);
    if (certUrl === undefined || !CERT_URL.test(certUrl)) {
      return errAsync(alexaRequestRejected());
    }
    const isNew = !knownCertUrls.has(certUrl);
    if (isNew && !reserveDownload()) {
      return errAsync(alexaRequestRejected());
    }
    return fromThrowableAsync(async () => {
      try {
        await deps.timestamp.verify(raw);
        await deps.signature.verify(raw, headers);
      } finally {
        if (isNew) {
          downloading = false;
        }
      }
      if (isNew && knownCertUrls.size < KNOWN_CERT_URLS_MAX) {
        knownCertUrls.add(certUrl);
      }
    }, alexaRequestRejected);
  };
}

export const verifyAlexaRequest = createAskRequestVerifier({
  signature: new SkillRequestSignatureVerifier(),
  timestamp: new TimestampVerifier(TOLERANCE_MS),
  now: () => Date.now(),
});

function readHeader(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];
  return typeof value === 'string' ? value : undefined;
}

function readTimestamp(value: unknown): number {
  if (typeof value !== 'object' || value === null || !('request' in value)) {
    return Number.NaN;
  }
  const request = value.request;
  if (typeof request !== 'object' || request === null || !('timestamp' in request)) {
    return Number.NaN;
  }
  return typeof request.timestamp === 'string' ? Date.parse(request.timestamp) : Number.NaN;
}

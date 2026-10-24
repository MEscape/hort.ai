import { SkillRequestSignatureVerifier, TimestampVerifier } from 'ask-sdk-express-adapter';

import type { UnauthorizedAppError } from '@lib/errors';
import { errAsync, fromThrowable, fromThrowableAsync, type AppResultAsync } from '@lib/result';
import { MS_PER_MINUTE, parseJson } from '@lib/utils';

import { alexaRequestRejected } from '../../domain/errors/alexa-errors';

import type { IncomingHttpHeaders } from 'node:http';

const TOLERANCE_MS = 150_000;
const CERT_URL_HEADER = 'signaturecertchainurl';
const CERT_HOST = 's3.amazonaws.com';
/** One file directly under /echo.api/, e.g. /echo.api/echo-api-cert-12.pem (the form Amazon sends). */
const CERT_PATH = /^\/echo\.api\/[A-Za-z0-9-]+\.pem$/;
/** Downloads of not yet verified certificate URLs per instance and window; Amazon rotates rarely. */
const DOWNLOAD_BUDGET = { max: 5, windowMs: MS_PER_MINUTE } as const;

type SignatureVerifier = Pick<SkillRequestSignatureVerifier, 'verify'>;

interface AlexaRequestVerifierOptions {
  /** Defaults to the official ASK SDK verifier; injectable so tests can observe its calls. */
  readonly signatureVerifier?: SignatureVerifier;
  readonly downloadBudget?: { readonly max: number; readonly windowMs: number };
}

type AlexaRequestVerifier = (
  raw: string,
  headers: IncomingHttpHeaders,
) => AppResultAsync<void, UnauthorizedAppError>;

/**
 * Official ASK verifiers behind three cheap guards that run before any certificate download: a symmetric,
 * finite timestamp window (the SDK only rejects old dates), one canonical certificate URL (no query, fragment,
 * port, credentials or path variants that would miss the SDK's per-URL cache) and a per-instance budget for
 * downloading certificate URLs that have not been verified yet.
 */
export function createAlexaRequestVerifier(
  options: AlexaRequestVerifierOptions = {},
): AlexaRequestVerifier {
  const signatureVerifier = options.signatureVerifier ?? new SkillRequestSignatureVerifier();
  const timestampVerifier = new TimestampVerifier(TOLERANCE_MS);
  const budget = options.downloadBudget ?? DOWNLOAD_BUDGET;
  const verifiedCertUrls = new Set<string>();
  let window = { startedAt: Number.NEGATIVE_INFINITY, used: 0 };

  function takeDownload(now: number): boolean {
    if (now - window.startedAt >= budget.windowMs) {
      window = { startedAt: now, used: 0 };
    }
    if (window.used >= budget.max) {
      return false;
    }
    window.used += 1;
    return true;
  }

  return (raw, headers) => {
    const parsed = fromThrowable(() => parseJson(raw), alexaRequestRejected);
    const timestamp = parsed.isOk() ? readTimestamp(parsed.value) : Number.NaN;
    const now = Date.now();
    if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > TOLERANCE_MS) {
      return errAsync(alexaRequestRejected());
    }
    const certUrl = canonicalCertUrl(readHeader(headers, CERT_URL_HEADER));
    if (certUrl === undefined) {
      return errAsync(alexaRequestRejected());
    }
    if (!verifiedCertUrls.has(certUrl) && !takeDownload(now)) {
      return errAsync(alexaRequestRejected());
    }
    return fromThrowableAsync(async () => {
      await timestampVerifier.verify(raw);
      await signatureVerifier.verify(raw, withHeader(headers, CERT_URL_HEADER, certUrl));
      verifiedCertUrls.add(certUrl);
    }, alexaRequestRejected);
  };
}

export const verifyAlexaRequest = createAlexaRequestVerifier();

/** The one canonical spelling of an Amazon signing-certificate URL, or undefined if it is not one. */
function canonicalCertUrl(value: string | undefined): string | undefined {
  if (value === undefined || /[?#@\\%]/.test(value) || !URL.canParse(value)) {
    return undefined;
  }
  const url = new URL(value);
  const isAmazonCert =
    url.protocol === 'https:' &&
    url.hostname === CERT_HOST &&
    url.port === '' &&
    CERT_PATH.test(url.pathname);
  return isAmazonCert ? `https://${CERT_HOST}${url.pathname}` : undefined;
}

/** Exactly one string value for the header (case-insensitive), otherwise undefined. */
function readHeader(headers: IncomingHttpHeaders, name: string): string | undefined {
  const values = Object.entries(headers)
    .filter(([key]) => key.toLowerCase() === name)
    .map(([, value]) => value);
  const [value] = values;
  return values.length === 1 && typeof value === 'string' ? value : undefined;
}

function withHeader(
  headers: IncomingHttpHeaders,
  name: string,
  value: string,
): IncomingHttpHeaders {
  const rest = Object.entries(headers).filter(([key]) => key.toLowerCase() !== name);
  return { ...Object.fromEntries(rest), [name]: value };
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

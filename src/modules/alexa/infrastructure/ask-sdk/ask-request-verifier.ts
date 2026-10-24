import { SkillRequestSignatureVerifier, TimestampVerifier } from 'ask-sdk-express-adapter';

import type { UnauthorizedAppError } from '@lib/errors';
import { errAsync, fromThrowable, fromThrowableAsync, type AppResultAsync } from '@lib/result';
import { parseJson } from '@lib/utils';

import { alexaRequestRejected } from '../../domain/errors/alexa-errors';

import type { IncomingHttpHeaders } from 'node:http';

const TOLERANCE_MS = 150_000;
const signatureVerifier = new SkillRequestSignatureVerifier();
const timestampVerifier = new TimestampVerifier(TOLERANCE_MS);

/** Official ASK verifiers plus a symmetric, finite timestamp guard (SDK only rejects old dates). */
export function verifyAlexaRequest(
  raw: string,
  headers: IncomingHttpHeaders,
): AppResultAsync<void, UnauthorizedAppError> {
  const parsed = fromThrowable(() => parseJson(raw), alexaRequestRejected);
  const timestamp = parsed.isOk() ? readTimestamp(parsed.value) : Number.NaN;
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > TOLERANCE_MS) {
    return errAsync(alexaRequestRejected());
  }
  return fromThrowableAsync(async () => {
    await timestampVerifier.verify(raw);
    await signatureVerifier.verify(raw, headers);
  }, alexaRequestRejected);
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

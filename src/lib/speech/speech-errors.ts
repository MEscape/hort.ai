import { infrastructureError } from '@lib/errors';
import type { AppError, InfrastructureAppError } from '@lib/errors';

/** Stable codes: greppable in logs, and what callers branch on instead of message text. */
export const SPEECH_ERROR_CODES = {
  /** Timeouts, provider 5xx, network failures: trying again later can succeed. */
  unavailable: 'speech.unavailable',
  /** The provider throttles us (too many concurrent requests). Waiting helps. */
  throttled: 'speech.throttled',
  /** The plan's quota is used up or the voice needs a paid plan: an operator must act. */
  quotaExceeded: 'speech.quota_exceeded',
  /** Bad key, unknown voice, malformed request: retrying cannot help, configuration must change. */
  rejected: 'speech.rejected',
} as const;

/** Every failure a `SpeechProvider` returns. Provider responses never cross the boundary: they become `cause`. */
export type SpeechError = InfrastructureAppError;

export function speechUnavailable(cause: unknown): InfrastructureAppError {
  return infrastructureError(
    SPEECH_ERROR_CODES.unavailable,
    'The speech service is temporarily unavailable.',
    cause,
  );
}

export function speechThrottled(cause: unknown): InfrastructureAppError {
  return infrastructureError(
    SPEECH_ERROR_CODES.throttled,
    'The speech service is busy. Try again shortly.',
    cause,
  );
}

export function speechQuotaExceeded(cause: unknown): InfrastructureAppError {
  return infrastructureError(
    SPEECH_ERROR_CODES.quotaExceeded,
    'The speech service quota is used up or the voice needs another plan.',
    cause,
  );
}

export function speechRejected(cause: unknown): InfrastructureAppError {
  return infrastructureError(
    SPEECH_ERROR_CODES.rejected,
    'The speech service rejected the request. Check its configuration.',
    cause,
  );
}

/** Only a transient failure is worth retrying; quota and configuration fail the same way again. */
export function isRetryableSpeechError(error: AppError): boolean {
  return (
    error.code === SPEECH_ERROR_CODES.unavailable || error.code === SPEECH_ERROR_CODES.throttled
  );
}

import { describe, expect, it } from 'vitest';

import {
  isRetryableSpeechError,
  speechQuotaExceeded,
  speechRejected,
  speechThrottled,
  speechUnavailable,
} from '@lib/speech';

describe('speech errors', () => {
  it('are infrastructure errors that keep their cause', () => {
    const cause = new Error('status 503');

    expect(speechUnavailable(cause)).toMatchObject({
      kind: 'infrastructure',
      code: 'speech.unavailable',
      cause,
    });
  });

  it('are worth a retry only when waiting can help', () => {
    expect(isRetryableSpeechError(speechUnavailable(null))).toBe(true);
    expect(isRetryableSpeechError(speechThrottled(null))).toBe(true);
    expect(isRetryableSpeechError(speechQuotaExceeded(null))).toBe(false);
    expect(isRetryableSpeechError(speechRejected(null))).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { MAIL_DELIVERY_FAILED, mailDeliveryFailed } from '@lib/mail';

describe('mailDeliveryFailed', () => {
  it('is an infrastructure error with a stable code and a generic message', () => {
    const cause = new Error('provider said: key sk-secret rejected');
    const error = mailDeliveryFailed(cause);

    expect(MAIL_DELIVERY_FAILED).toBe('mail.delivery_failed');
    expect(error).toEqual({
      kind: 'infrastructure',
      code: 'mail.delivery_failed',
      message: 'The email could not be delivered.',
      cause,
    });
    expect(error.message).not.toContain('sk-secret');
  });
});

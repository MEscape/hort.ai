import { infrastructureError } from '@lib/errors';
import type { InfrastructureAppError } from '@lib/errors';

/** Stable code of a message that could not be delivered. The cause carries the provider's detail. */
export const MAIL_DELIVERY_FAILED = 'mail.delivery_failed';

export function mailDeliveryFailed(cause: unknown): InfrastructureAppError {
  return infrastructureError(MAIL_DELIVERY_FAILED, 'The email could not be delivered.', cause);
}

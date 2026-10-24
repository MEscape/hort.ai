import { unauthorizedError, type UnauthorizedAppError } from '@lib/errors';

/** The request is not provably from Alexa (signature, certificate or timestamp check failed). */
export function alexaRequestRejected(): UnauthorizedAppError {
  return unauthorizedError('alexa.request_rejected', 'Alexa request could not be verified.');
}

import {
  unauthorizedError,
  validationError,
  type UnauthorizedAppError,
  type ValidationAppError,
} from '@lib/errors';

/** The request is not provably from Alexa (signature, certificate or timestamp check failed). */
export function alexaRequestRejected(): UnauthorizedAppError {
  return unauthorizedError('alexa.request_rejected', 'Alexa request could not be verified.');
}

/** The session id Alexa sent cannot identify a conversation (empty or too long). */
export function conversationIdInvalid(): ValidationAppError {
  return validationError('alexa.conversation_id_invalid', 'Alexa session id is invalid.', {});
}

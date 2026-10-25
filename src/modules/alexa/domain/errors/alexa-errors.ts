import {
  infrastructureError,
  unauthorizedError,
  validationError,
  type InfrastructureAppError,
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

/** Amazon's signing certificate could not be fetched in time (stalled, refused, wrong status or size). */
export function certificateDownloadFailed(reason: string, cause?: unknown): InfrastructureAppError {
  return infrastructureError(
    'alexa.certificate_download_failed',
    `Alexa signing certificate download failed: ${reason}.`,
    cause,
  );
}

/** A tutor id that cannot name a catalog tutor (wrong shape). */
export function tutorIdInvalid(): ValidationAppError {
  return validationError('alexa.tutor_id_invalid', 'Tutor id is invalid.', {});
}

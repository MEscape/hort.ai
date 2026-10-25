import { validationError } from '@lib/errors';
import type { ValidationAppError } from '@lib/errors';

/** Stable code for a rejected topic classification (docs/architecture/topic-classification.md). */
export const TOPIC_CLASSIFICATION_ERROR_CODES = {
  rejected: 'guidance.topic_classification_rejected',
} as const;

/** Why a topic classification was rejected, carried in `fieldErrors` under the offending field (`$` for the whole output). */
export const TOPIC_CLASSIFICATION_VALIDATION_CODES = {
  notAnObject: 'guidance.topic_classification.not_an_object',
  unsupportedVersion: 'guidance.topic_classification.unsupported_version',
  unknownField: 'guidance.topic_classification.unknown_field',
  missingField: 'guidance.topic_classification.missing_field',
  invalidType: 'guidance.topic_classification.invalid_type',
  invalidIntent: 'guidance.topic_classification.invalid_intent',
  invalidSubject: 'guidance.topic_classification.invalid_subject',
  invalidConfidence: 'guidance.topic_classification.invalid_confidence',
  invalidTopicKind: 'guidance.topic_classification.invalid_topic_kind',
  unknownCompetency: 'guidance.topic_classification.unknown_competency',
  invalidLabel: 'guidance.topic_classification.invalid_label',
  unsafeLabel: 'guidance.topic_classification.unsafe_label',
  inconsistentTopic: 'guidance.topic_classification.inconsistent_topic',
} as const;

export type TopicClassificationValidationCode =
  (typeof TOPIC_CLASSIFICATION_VALIDATION_CODES)[keyof typeof TOPIC_CLASSIFICATION_VALIDATION_CODES];

/** The rejection of a topic classification: every violation found, keyed by field. */
export function topicClassificationRejected(
  fieldErrors: Record<string, TopicClassificationValidationCode[]>,
): ValidationAppError {
  return validationError(
    TOPIC_CLASSIFICATION_ERROR_CODES.rejected,
    'The topic classification violates its contract.',
    fieldErrors,
  );
}

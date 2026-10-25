import type { MessageCatalog } from '@i18n';

import { fieldPath } from '@lib/errors/validation';
import type { NestedKeyOf } from '@lib/errors/validation';

import {
  AI_OUTPUT_ERROR_CODES as AI_OUTPUT,
  AI_OUTPUT_VALIDATION_CODES as AI_FIELD,
  CHILD_INPUT_ERROR_CODES as CHILD_INPUT,
  CHILD_INPUT_VALIDATION_CODES as CHILD_FIELD,
  CHILD_SAFETY_VALIDATION_CODES as SAFETY,
  GUIDANCE_ERROR_CODES as ERRORS,
  GUIDANCE_VALIDATION_CODES as VALIDATION,
  SOLUTION_LEAK_VALIDATION_CODES as LEAK,
  TOPIC_CLASSIFICATION_ERROR_CODES as TOPIC,
  TOPIC_CLASSIFICATION_VALIDATION_CODES as TOPIC_FIELD,
} from '../../application/contracts/guidance-constraints';

import type { GuidanceCode } from '../../application/contracts/guidance-constraints';

type ValidKeys = NestedKeyOf<MessageCatalog['guidance']>;

const VALIDATION_KEY = fieldPath('errors', 'validation');
const CHILD_INPUT_KEY = fieldPath('errors', 'childInputInvalid');

export const GENERIC_ERROR_MESSAGE_KEY = fieldPath('errors', 'unexpected');

/**
 * Codes -> translation keys, relative to the `guidance` namespace. `satisfies Record<...>` makes a
 * new code fail to compile until it has a message. AI output, child-safety and solution-leak codes never reach the
 * child (a rejected AI text becomes the predefined prompt), so they get the generic message; so do the topic classification codes (#92), which only ever lead to a fallback.
 */
export const MESSAGE_KEY_BY_CODE = {
  [ERRORS.validationFailed]: VALIDATION_KEY,
  [ERRORS.rateLimited]: fieldPath('errors', 'rateLimited'),
  [ERRORS.rateLimiterFailed]: fieldPath('errors', 'infrastructure'),
  [ERRORS.sessionNotFound]: fieldPath('errors', 'sessionNotFound'),
  [ERRORS.sessionStoreFailed]: fieldPath('errors', 'infrastructure'),
  [ERRORS.noOpenQuestion]: fieldPath('errors', 'noOpenQuestion'),
  [ERRORS.assignmentNotFound]: fieldPath('errors', 'assignmentNotFound'),
  [ERRORS.learningWindowClosed]: fieldPath('errors', 'learningWindowClosed'),
  [ERRORS.dailyLimitReached]: fieldPath('errors', 'dailyLimitReached'),
  [VALIDATION.childProfileIdInvalid]: VALIDATION_KEY,
  [VALIDATION.subjectInvalid]: VALIDATION_KEY,
  [VALIDATION.sessionIdInvalid]: VALIDATION_KEY,
  [VALIDATION.requestIdInvalid]: VALIDATION_KEY,
  [VALIDATION.assignmentIdInvalid]: VALIDATION_KEY,
  [VALIDATION.classroomIdInvalid]: VALIDATION_KEY,
  [CHILD_INPUT.invalid]: CHILD_INPUT_KEY,
  [CHILD_FIELD.empty]: CHILD_INPUT_KEY,
  [CHILD_FIELD.tooLong]: CHILD_INPUT_KEY,
  [CHILD_FIELD.containsControlCharacter]: CHILD_INPUT_KEY,
  [AI_OUTPUT.rejected]: GENERIC_ERROR_MESSAGE_KEY,
  [AI_FIELD.notAnObject]: GENERIC_ERROR_MESSAGE_KEY,
  [AI_FIELD.unsupportedVersion]: GENERIC_ERROR_MESSAGE_KEY,
  [AI_FIELD.unknownKind]: GENERIC_ERROR_MESSAGE_KEY,
  [AI_FIELD.unexpectedKind]: GENERIC_ERROR_MESSAGE_KEY,
  [AI_FIELD.unknownField]: GENERIC_ERROR_MESSAGE_KEY,
  [AI_FIELD.missingField]: GENERIC_ERROR_MESSAGE_KEY,
  [AI_FIELD.invalidType]: GENERIC_ERROR_MESSAGE_KEY,
  [AI_FIELD.invalidHintLevel]: GENERIC_ERROR_MESSAGE_KEY,
  [AI_FIELD.unexpectedHintLevel]: GENERIC_ERROR_MESSAGE_KEY,
  [AI_FIELD.invalidCompetencyId]: GENERIC_ERROR_MESSAGE_KEY,
  [AI_FIELD.invalidAssessmentResult]: GENERIC_ERROR_MESSAGE_KEY,
  [AI_FIELD.textEmpty]: GENERIC_ERROR_MESSAGE_KEY,
  [AI_FIELD.textTooLong]: GENERIC_ERROR_MESSAGE_KEY,
  [AI_FIELD.notAQuestion]: GENERIC_ERROR_MESSAGE_KEY,
  [AI_FIELD.containsControlCharacter]: GENERIC_ERROR_MESSAGE_KEY,
  [AI_FIELD.containsUrl]: GENERIC_ERROR_MESSAGE_KEY,
  [AI_FIELD.containsMarkup]: GENERIC_ERROR_MESSAGE_KEY,
  [AI_FIELD.containsCode]: GENERIC_ERROR_MESSAGE_KEY,
  [AI_FIELD.solutionLeaked]: GENERIC_ERROR_MESSAGE_KEY,
  [SAFETY.asksForPersonalData]: GENERIC_ERROR_MESSAGE_KEY,
  [SAFETY.asksForSecrecy]: GENERIC_ERROR_MESSAGE_KEY,
  [SAFETY.inappropriateContent]: GENERIC_ERROR_MESSAGE_KEY,
  [SAFETY.discouraging]: GENERIC_ERROR_MESSAGE_KEY,
  [LEAK.statesResult]: GENERIC_ERROR_MESSAGE_KEY,
  [LEAK.announcesResult]: GENERIC_ERROR_MESSAGE_KEY,
  [LEAK.dictatesAnswer]: GENERIC_ERROR_MESSAGE_KEY,
  [LEAK.worksTheTask]: GENERIC_ERROR_MESSAGE_KEY,
  [LEAK.revealsKeyText]: GENERIC_ERROR_MESSAGE_KEY,
  [TOPIC.rejected]: GENERIC_ERROR_MESSAGE_KEY,
  [TOPIC_FIELD.notAnObject]: GENERIC_ERROR_MESSAGE_KEY,
  [TOPIC_FIELD.unsupportedVersion]: GENERIC_ERROR_MESSAGE_KEY,
  [TOPIC_FIELD.unknownField]: GENERIC_ERROR_MESSAGE_KEY,
  [TOPIC_FIELD.missingField]: GENERIC_ERROR_MESSAGE_KEY,
  [TOPIC_FIELD.invalidType]: GENERIC_ERROR_MESSAGE_KEY,
  [TOPIC_FIELD.invalidIntent]: GENERIC_ERROR_MESSAGE_KEY,
  [TOPIC_FIELD.invalidSubject]: GENERIC_ERROR_MESSAGE_KEY,
  [TOPIC_FIELD.invalidConfidence]: GENERIC_ERROR_MESSAGE_KEY,
  [TOPIC_FIELD.invalidTopicKind]: GENERIC_ERROR_MESSAGE_KEY,
  [TOPIC_FIELD.unknownCompetency]: GENERIC_ERROR_MESSAGE_KEY,
  [TOPIC_FIELD.invalidLabel]: GENERIC_ERROR_MESSAGE_KEY,
  [TOPIC_FIELD.unsafeLabel]: GENERIC_ERROR_MESSAGE_KEY,
  [TOPIC_FIELD.inconsistentTopic]: GENERIC_ERROR_MESSAGE_KEY,
} as const satisfies Record<GuidanceCode, ValidKeys>;

export type MessageKey =
  (typeof MESSAGE_KEY_BY_CODE)[GuidanceCode] | typeof GENERIC_ERROR_MESSAGE_KEY;

function isGuidanceCode(code: string): code is GuidanceCode {
  return Object.hasOwn(MESSAGE_KEY_BY_CODE, code);
}

/** Codes from other modules (authorization, learner) get the generic message. */
/** @keep Used by the child's help screen to translate an action error. */
export function messageKeyForCode(code: string): MessageKey {
  return isGuidanceCode(code) ? MESSAGE_KEY_BY_CODE[code] : GENERIC_ERROR_MESSAGE_KEY;
}

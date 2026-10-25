import {
  AI_OUTPUT_ERROR_CODES,
  AI_OUTPUT_VALIDATION_CODES,
} from '../../domain/errors/ai-output-errors';
import {
  CHILD_INPUT_ERROR_CODES,
  CHILD_INPUT_VALIDATION_CODES,
} from '../../domain/errors/child-input-errors';
import { CHILD_SAFETY_VALIDATION_CODES } from '../../domain/errors/child-safety-errors';
import {
  GUIDANCE_ERROR_CODES,
  GUIDANCE_VALIDATION_CODES,
} from '../../domain/errors/guidance-errors';
import { SOLUTION_LEAK_VALIDATION_CODES } from '../../domain/errors/solution-leak-errors';
import {
  TOPIC_CLASSIFICATION_ERROR_CODES,
  TOPIC_CLASSIFICATION_VALIDATION_CODES,
} from '../../domain/errors/topic-classification-errors';

/**
 * What the presentation boundary needs about guidance input and errors: the stable codes and the
 * size bounds. The use cases check every rule again; these only keep oversized input out.
 */
export {
  AI_OUTPUT_ERROR_CODES,
  AI_OUTPUT_VALIDATION_CODES,
  CHILD_INPUT_ERROR_CODES,
  CHILD_INPUT_VALIDATION_CODES,
  CHILD_SAFETY_VALIDATION_CODES,
  GUIDANCE_ERROR_CODES,
  GUIDANCE_VALIDATION_CODES,
  SOLUTION_LEAK_VALIDATION_CODES,
  TOPIC_CLASSIFICATION_ERROR_CODES,
  TOPIC_CLASSIFICATION_VALIDATION_CODES,
};
export { CHILD_TASK_TEXT_MAX_LENGTH } from '../../domain/models/child-task-text';

/** No id or request key of a session step is longer; the domain checks the exact shape. */
export const GUIDANCE_ID_MAX_LENGTH = 128;

type ValuesOf<T> = T[keyof T];

/** Every stable code of the guidance module. */
export type GuidanceCode =
  | ValuesOf<typeof AI_OUTPUT_ERROR_CODES>
  | ValuesOf<typeof AI_OUTPUT_VALIDATION_CODES>
  | ValuesOf<typeof CHILD_INPUT_ERROR_CODES>
  | ValuesOf<typeof CHILD_INPUT_VALIDATION_CODES>
  | ValuesOf<typeof CHILD_SAFETY_VALIDATION_CODES>
  | ValuesOf<typeof GUIDANCE_ERROR_CODES>
  | ValuesOf<typeof GUIDANCE_VALIDATION_CODES>
  | ValuesOf<typeof SOLUTION_LEAK_VALIDATION_CODES>
  | ValuesOf<typeof TOPIC_CLASSIFICATION_ERROR_CODES>
  | ValuesOf<typeof TOPIC_CLASSIFICATION_VALIDATION_CODES>;

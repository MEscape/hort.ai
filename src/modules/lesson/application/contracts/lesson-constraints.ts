export { LESSON_ERROR_CODES, LESSON_VALIDATION_CODES } from '../../domain/errors/lesson-errors';
export type { LessonCode } from '../../domain/errors/lesson-errors';
export {
  COMPARE_CHOICES,
  FRACTION_LIMITS,
  GROUPS_LIMITS,
  NUMBER_LINE_LIMITS,
  LESSON_SCHEMA_VERSION,
  TEXT_ANSWER_MAX_LENGTH,
} from '../../domain/models/lesson-step';
export type {
  BuildBridgeScene,
  ChildInput,
  CompareBridgesScene,
  CompareChoice,
  GroupsScene,
  NumberLineScene,
  Fraction,
  MascotState,
  Outcome,
  Scene,
  SceneAnswer,
  SceneReaction,
  SceneTemplate,
  StepFeedback,
} from '../../domain/models/lesson-step';

/** The miss from which a step answers with its hint instead of a plain "not yet". */
export const HINT_FROM_ATTEMPT = 2;

/** A client counts tries per step; anything above this is not a child tapping. */
export const MAX_ATTEMPT = 50;

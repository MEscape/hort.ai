/**
 * Server-side public API of the progression module: a child's small, non-punishing progress (XP,
 * a level out of six, one daily reward) and the companion's mood, all derived from an append-only
 * ledger of rewards the backend confirmed. Server Actions call the commands; Server Components load
 * the DTO. Every use case authorizes the signed-in parent itself and only ever touches that
 * parent's own children. There is no streak and nothing is ever taken away.
 */

export { getProgressionCommands, getProgressionQueries } from './composition';

export type { AwardLearningXpError } from './application/commands/award-learning-xp';
export type { ClaimDailyRewardError } from './application/commands/claim-daily-reward';
export type { GetProgressError } from './application/queries/get-progress';
export {
  LEARNING_EVENT_KEY_MAX_LENGTH,
  LEARNING_EVENT_XP,
  MAX_LEVEL,
  PROGRESSION_ERROR_CODES,
  PROGRESSION_VALIDATION_CODES,
} from './application/contracts/progression-constraints';
export type {
  CompanionMood,
  LearningEventKind,
  ProgressionCode,
} from './application/contracts/progression-constraints';
export type {
  AwardLearningXpInput,
  ClaimDailyRewardInput,
  GetProgressInput,
} from './application/contracts/progression-inputs';
export type {
  AwardLearningXpView,
  ClaimDailyRewardView,
  ProgressView,
} from './application/contracts/progression-views';

/** Framework entry point for pages: the child's progress as plain values; a failure throws. */
export { loadProgressDto } from './presentation/guards/load-progress-dto';
export type { ClaimDailyRewardDto, ProgressDto } from './presentation/dto/progress-dto';

/** The module's message catalogs, registered in `src/i18n/locales`. */
export { default as enProgression } from './presentation/i18n/en.json';
export { default as deProgression } from './presentation/i18n/de.json';

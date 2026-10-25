/** Browser-safe vocabulary and interactions of the learner module. No composition or provider imports. */
export { saveChildInterestsAction } from './presentation/actions/save-child-interests-action';
export { chooseChildTutorAction } from './presentation/actions/choose-child-tutor-action';
export { completeChildWelcomeAction } from './presentation/actions/complete-child-welcome-action';
export {
  INTERESTS,
  LEARNER_ERROR_CODES,
  LEARNER_LIMITS,
  LEARNER_TIME_ZONE,
  LOW_TIME_MINUTES,
  computeScreenTime,
} from './application/contracts/learner-constraints';
export type {
  Interest,
  ScreenTime,
  ScreenTimeStatus,
  ScreenTimeUsage,
} from './application/contracts/learner-constraints';
export type { ChildProfileDto } from './presentation/dto/learner-dto';
export { learnerRoutes } from './presentation/routes';
export { INTEREST_ICONS } from './presentation/components/interest-icons';
export type { TutorOption } from './presentation/components/tutor-option';
export { bestFits } from './presentation/components/tutor-fit';

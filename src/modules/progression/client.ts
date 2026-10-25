/** Browser-safe vocabulary and interactions of the progression module. No composition or provider imports. */
export { claimDailyRewardAction } from './presentation/actions/claim-daily-reward-action';
export {
  PROGRESSION_ERROR_CODES,
  MAX_LEVEL,
} from './application/contracts/progression-constraints';
export type {
  BoredomLevel,
  ClaimDailyRewardDto,
  CompanionMood,
  ProgressDto,
} from './presentation/dto/progress-dto';

export { CompanionAvatar } from './presentation/components/companion-avatar';
export type {
  CompanionAvatarProps,
  CompanionReaction,
} from './presentation/components/companion-avatar';
export type { CompanionVisual } from './presentation/components/companion-visual';
export { LevelMeter } from './presentation/components/level-meter';
export { RewardsStep } from './presentation/components/rewards-step';
export { CompanionCard } from './presentation/components/companion-card';

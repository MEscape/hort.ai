import { literalGuard } from '@lib/utils';

/**
 * The parent's setup in the order it is walked. The stored step is the furthest one the parent has
 * reached: it only moves forward, and editing an earlier step never moves it back. `done` means the
 * setup is finished (`setupCompletedAt` is set).
 */
export const SETUP_STEPS = ['child', 'interests', 'tutor', 'controls', 'review', 'done'] as const;

export type SetupStep = (typeof SETUP_STEPS)[number];

export const isSetupStep = literalGuard(SETUP_STEPS);

/** The steps strictly before `step`: the ones from which reaching `step` is an advance. */
export function stepsBefore(step: SetupStep): readonly SetupStep[] {
  return SETUP_STEPS.slice(0, SETUP_STEPS.indexOf(step));
}

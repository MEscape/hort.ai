/**
 * The hint ladder (#30), lowest help first: understand the task, activate prior knowledge, point to the
 * next step, a worked example on a similar but different problem. No level reveals the solution. The
 * backend picks the level from the session state; the AI never does.
 */
export const HINT_LEVELS = [
  'understand_task',
  'activate_prior_knowledge',
  'next_step',
  'similar_example',
] as const;

export type HintLevel = (typeof HINT_LEVELS)[number];

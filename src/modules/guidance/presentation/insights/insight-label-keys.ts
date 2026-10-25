import type { HelpSessionStatus } from '../../domain/models/help-session';
import type { HintLevel } from '../../domain/models/hint-level';

/** Each status's friendly word for parents (#35), written out so every key is checked. */
export const STATUS_LABEL_KEYS = {
  completed: 'insights.parent.status.completed',
  active: 'insights.parent.status.active',
  abandoned: 'insights.parent.status.abandoned',
} as const satisfies Record<HelpSessionStatus, string>;

/** Each rung of the hint ladder in parents' words. */
export const LEVEL_LABEL_KEYS = {
  understand_task: 'insights.parent.level.understand_task',
  activate_prior_knowledge: 'insights.parent.level.activate_prior_knowledge',
  next_step: 'insights.parent.level.next_step',
  similar_example: 'insights.parent.level.similar_example',
} as const satisfies Record<HintLevel, string>;

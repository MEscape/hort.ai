import { MS_PER_MINUTE } from '@lib/utils';

import type { GreetingMemory } from './greeting-memory';
import type { GuideLine } from './home-types';

/** Where the greeting points: a card, or the stage the companion already stands on. */
export type GreetingTarget = 'continue' | 'stage';

export interface Greeting {
  readonly line: Extract<GuideLine, 'hello' | 'welcomeBack'>;
  readonly target: GreetingTarget;
}

/** The same child is not greeted again within this time: a refresh or a quick return stays quiet. */
const COOLDOWN_MINUTES = 10;
export const GREETING_COOLDOWN_MS = COOLDOWN_MINUTES * MS_PER_MINUTE;

/**
 * The one greeting: a short hello, or, when a task is waiting, a welcome back that points at it.
 * No name, no time of day and no hunger: the page already shows the rest, and the same words are
 * what the companion says aloud.
 */
export function pickGreeting({ hasUnfinished }: { readonly hasUnfinished: boolean }): Greeting {
  return hasUnfinished
    ? { line: 'welcomeBack', target: 'continue' }
    : { line: 'hello', target: 'stage' };
}

export function shouldGreet(memory: GreetingMemory | null, now: number): boolean {
  if (memory === null) {
    return true;
  }
  const elapsed = now - memory.at;
  return elapsed < 0 || elapsed >= GREETING_COOLDOWN_MS;
}

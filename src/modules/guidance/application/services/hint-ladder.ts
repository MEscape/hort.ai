import { nextHintLevel } from '../../domain/hint-ladder/next-hint-level';
import { HINT_LEVELS } from '../../domain/models/hint-level';

import { groundInCurriculum, solutionKeyOf } from './session-step';

import type { OpenSession } from './session-step';
import type { GivenHint } from '../../domain/models/help-session-state';
import type { StepRequestId } from '../../domain/models/ids';
import type { HintOutcome, HintStep } from '../contracts/hint-views';
import type { RequestHintDependencies } from '../guidance-dependencies';

/** A hint for the child, and whether it is one already given for the same request id. */
export interface LadderHint {
  readonly given: HintStep;
  readonly isReplay: boolean;
}

function toStep(hint: HintOutcome): HintStep {
  const index = HINT_LEVELS.indexOf(hint.level);
  return { hint, step: index + 1, isTopStep: index === HINT_LEVELS.length - 1 };
}

function toOutcome(hint: GivenHint): HintOutcome {
  return hint.kind === 'generated'
    ? { kind: 'generated', level: hint.level, text: hint.text }
    : { kind: 'fallback', level: hint.level, reason: hint.reason };
}

/**
 * The next rung of the ladder for an open session (#30). The level comes from the stored session
 * alone; the AI only words it, through the orchestrator's checks. A retried request (same id) gets
 * the hint it already got, without asking the AI again. The hint is recorded for the session; if
 * that fails the child still gets it, and the failure is logged with its code, because a hint the
 * child cannot see is worse than one rung that may be offered twice.
 */
export async function giveNextHint(
  deps: Pick<
    RequestHintDependencies,
    'hints' | 'sessions' | 'competencies' | 'assignments' | 'audit'
  >,
  session: OpenSession,
  requestId: StepRequestId,
): Promise<LadderHint> {
  const earlier = session.state.hints.find((hint) => hint.requestId === requestId);
  if (earlier !== undefined) {
    return { given: toStep(toOutcome(earlier)), isReplay: true };
  }
  const level = nextHintLevel(session.state);
  const [competencies, solutionKey] = await Promise.all([
    groundInCurriculum(deps, session, level),
    solutionKeyOf(deps, session, 'hint'),
  ]);
  // The key only checks the AI's text for a leak (#31); it is never part of the request to the AI.
  const outcome = await deps.hints.suggest(
    { task: session.state.task, level, competencies },
    solutionKey,
  );
  const recorded = await deps.sessions.recordHint(session.ref, { requestId, ...outcome });
  if (recorded.isErr()) {
    deps.audit.record({
      type: 'guidance.step_not_recorded',
      step: 'hint',
      code: recorded.error.code,
    });
  }
  return { given: toStep(outcome), isReplay: false };
}

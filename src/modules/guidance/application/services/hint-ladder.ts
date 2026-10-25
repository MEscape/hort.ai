import { nextHintLevel } from '../../domain/hint-ladder/next-hint-level';
import { HINT_LEVELS } from '../../domain/models/hint-level';
import { EARLIER_HINT_LIMIT } from '../../domain/models/hint-request';

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
 * the hint it already got, without asking the AI again; a request that raced another one from the
 * same state gets the hint the store kept for that rung. The AI sees the latest earlier hints and
 * the last answer's result (never its text) as data, so it builds on them. The hint is recorded
 * for the session; if that fails the child still gets it, and the failure is logged with its
 * code, because a hint the child cannot see is worse than one rung that may be offered twice.
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
  const { state } = session;
  const level = nextHintLevel(state);
  const [competencies, solutionKey] = await Promise.all([
    groundInCurriculum(deps, session, level),
    solutionKeyOf(deps, session, 'hint'),
  ]);
  // The key only checks the AI's text for a leak (#31); it is never part of the request to the AI.
  const outcome = await deps.hints.suggest(
    {
      task: state.task,
      level,
      competencies,
      earlierHints: state.hints
        .flatMap((hint) =>
          hint.kind === 'generated' ? [{ level: hint.level, text: hint.text }] : [],
        )
        .slice(-EARLIER_HINT_LIMIT),
      lastAnswerResult: state.answers.at(-1) ?? null,
    },
    solutionKey,
  );
  const after = state.hints.at(-1)?.requestId ?? null;
  const recorded = await deps.sessions.recordHint(session.ref, { requestId, ...outcome }, after);
  if (recorded.isErr()) {
    deps.audit.record({
      type: 'guidance.step_not_recorded',
      step: 'hint',
      code: recorded.error.code,
    });
  }
  if (recorded.isOk() && recorded.value === 'duplicate') {
    const stored = await storedInstead(deps, session, requestId);
    if (stored !== null) {
      return { given: toStep(toOutcome(stored)), isReplay: true };
    }
  }
  return { given: toStep(outcome), isReplay: false };
}

/**
 * The hint a concurrent request recorded instead of this one: its twin under the same request id,
 * or the hint another request recorded for the same rung. `null` when it cannot be read back; the
 * child then gets this request's own hint, unrecorded.
 */
async function storedInstead(
  deps: Pick<RequestHintDependencies, 'sessions'>,
  session: OpenSession,
  requestId: StepRequestId,
): Promise<GivenHint | null> {
  const reloaded = await deps.sessions.load(session.ref);
  if (reloaded.isErr()) {
    return null;
  }
  const { hints } = reloaded.value;
  return hints.find((hint) => hint.requestId === requestId) ?? hints.at(-1) ?? null;
}

import type { Actor } from '@modules/auth';

import type { RateLimitedAppError, ValidationAppError } from '@lib/errors';
import type { RateLimitPolicy } from '@lib/rate-limit';
import type { AppResult, AppResultAsync } from '@lib/result';

import { fromRateLimitFailure } from '../../domain/errors/guidance-errors';
import {
  parseChildProfileId,
  parseHelpSessionId,
  parseStepRequestId,
} from '../../domain/models/ids';

import type { HintLadderState } from '../../domain/models/help-session-state';
import type { HintLevel } from '../../domain/models/hint-level';
import type { CurriculumCompetency } from '../../domain/models/hint-request';
import type { ChildProfileId, HelpSessionId, StepRequestId } from '../../domain/models/ids';
import type {
  ChildProfileAccessError,
  OwnChildProfile,
} from '../../domain/ports/child-profile-access.port';
import type {
  HelpSessionRef,
  HintSessionStoreError,
} from '../../domain/ports/hint-session-store.port';
import type { HelpSessionStepInput } from '../contracts/hint-inputs';
import type { SessionStepDependencies } from '../guidance-dependencies';

/** The checked ids every step of a help session carries. */
export interface SessionStep {
  readonly childProfileId: ChildProfileId;
  readonly sessionId: HelpSessionId;
  readonly requestId: StepRequestId;
}

/** An active session of one of the actor's own children, admitted within the child's budget. */
export interface OpenSession {
  readonly child: OwnChildProfile;
  readonly ref: HelpSessionRef;
  readonly state: HintLadderState;
}

export type OpenSessionError =
  ChildProfileAccessError | RateLimitedAppError | HintSessionStoreError;

/** The cheap input checks, before anything is looked up or counted. */
export function parseSessionStep(
  input: HelpSessionStepInput,
): AppResult<SessionStep, ValidationAppError> {
  return parseChildProfileId(input.childProfileId).andThen((childProfileId) =>
    parseHelpSessionId(input.sessionId).andThen((sessionId) =>
      parseStepRequestId(input.requestId).map((requestId) => ({
        childProfileId,
        sessionId,
        requestId,
      })),
    ),
  );
}

/**
 * The child must be the actor's own (another parent's child is "not found"), each step spends one
 * of that child's budget under `policy` (counted per child, so siblings do not use up each other's
 * help), and the session must be an active one of exactly this parent and child.
 */
export function openOwnSession(
  {
    childProfiles,
    rateLimiter,
    sessions,
  }: Pick<SessionStepDependencies, 'childProfiles' | 'rateLimiter' | 'sessions'>,
  {
    actor,
    step,
    policy,
  }: { readonly actor: Actor; readonly step: SessionStep; readonly policy: RateLimitPolicy },
): AppResultAsync<OpenSession, OpenSessionError> {
  return childProfiles.findOwn(step.childProfileId).andThen((child) => {
    const ref: HelpSessionRef = {
      tenantId: actor.tenantId,
      ownerId: actor.id,
      childProfileId: child.id,
      sessionId: step.sessionId,
    };
    return rateLimiter
      .enforce({
        policy,
        subject: { kind: 'identifier', value: `child-profile:${actor.tenantId}:${child.id}` },
      })
      .mapErr(fromRateLimitFailure)
      .andThen(() => sessions.load(ref))
      .map((state) => ({ child, ref, state }));
  });
}

/**
 * The competencies of the child's own state and grade (#28). Without them the AI's text is less
 * specific, not wrong, so a failed retrieval is logged and the request goes ahead ungrounded.
 */
export async function groundInCurriculum(
  { competencies, audit }: Pick<SessionStepDependencies, 'competencies' | 'audit'>,
  { child, state }: OpenSession,
  level: HintLevel,
): Promise<readonly CurriculumCompetency[]> {
  const found = await competencies.findFor({
    federalState: child.federalState,
    grade: child.grade,
    subject: state.subject,
    task: state.task,
  });
  if (found.isErr()) {
    audit.record({ type: 'guidance.grounding_unavailable', level, code: found.error.code });
    return [];
  }
  return found.value;
}

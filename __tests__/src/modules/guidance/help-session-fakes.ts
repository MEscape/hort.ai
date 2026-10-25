import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import type { Actor } from '@modules/auth/domain/models/actor';
import type { HelpSessionDependencies } from '@modules/guidance/application/help-session-dependencies';
import { toLadderState } from '@modules/guidance/domain/models/help-session';
import type { HelpSession } from '@modules/guidance/domain/models/help-session';
import { HINT_LEVELS } from '@modules/guidance/domain/models/hint-level';
import { toHelpSessionId } from '@modules/guidance/domain/models/ids';
import type { ChildProfileAccess } from '@modules/guidance/domain/ports/child-profile-access.port';
import type {
  HelpSessionRepository,
  NewHelpSession,
} from '@modules/guidance/domain/ports/help-session.repository';
import type { TopicClassifier } from '@modules/guidance/domain/ports/topic-classifier.port';
import { UNCLASSIFIED_TOPIC } from '@modules/guidance/domain/topic/session-topic';

import { notFoundError } from '@lib/errors';
import type { RateLimiter } from '@lib/rate-limit';
import { errAsync, okAsync } from '@lib/result';

import { createTestRateLimiter } from '../../support/rate-limiting';
import { parent, recordingAudit as recordingSecurityAudit, signedInAs } from '../auth/fakes';

import {
  OWN_CHILD,
  fakeAssignments,
  fakeCompetencies,
  ownChildren,
  recordingAuditLog,
  task,
} from './fakes';

const UPDATED_AT = new Date('2026-10-25T08:00:00.000Z');

/** A stored session of the own child; override what a test is about. */
export function storedSession(overrides: Partial<HelpSession> = {}): HelpSession {
  return {
    id: toHelpSessionId('session-1'),
    childProfileId: OWN_CHILD,
    assignmentId: null,
    task: task('Rechne 23 + 19.'),
    subject: 'math',
    status: 'active',
    hintLevel: null,
    startedAt: UPDATED_AT,
    updatedAt: UPDATED_AT,
    hints: [],
    answerChecks: [],
    topic: UNCLASSIFIED_TOPIC,
    ...overrides,
  };
}

const notFound = () =>
  notFoundError('guidance.session_not_found', 'The help session was not found.');

/**
 * An in-memory store with the port's contract: one active session per child, scoped to the owner
 * that started it, hints and answer checks once per request id. It keeps what it was asked, for the assertions.
 */
export function inMemorySessions(initial: readonly HelpSession[] = []) {
  const sessions = new Map(initial.map((session) => [session.id as string, session]));
  const starts: NewHelpSession[] = [];
  const replies: Array<{ readonly completes: boolean; readonly text: string }> = [];
  let created = 0;
  /** What `helpMinutesBetween` answers; a test sets it to reach the daily limit. */
  const usage = { helpMinutes: 0 };

  const active = (childProfileId: string, sessionId?: string) =>
    [...sessions.values()].find(
      (session) =>
        session.status === 'active' &&
        session.childProfileId === childProfileId &&
        (sessionId === undefined || session.id === sessionId),
    ) ?? null;

  const repository: HelpSessionRepository = {
    start: (_owner, start) => {
      starts.push(start);
      if (start.replaces !== null) {
        const replaced = sessions.get(start.replaces);
        if (replaced !== undefined) {
          sessions.set(replaced.id, { ...replaced, status: 'abandoned' });
        }
      }
      created += 1;
      const session = storedSession({
        id: toHelpSessionId(`session-new-${String(created)}`),
        childProfileId: start.childProfileId,
        assignmentId: start.assignmentId,
        task: start.task,
        subject: start.subject,
        topic: start.topic,
      });
      sessions.set(session.id, session);
      return okAsync({ session, created: true });
    },
    findOpen: (_owner, childProfileId) => okAsync(active(childProfileId)),
    helpMinutesBetween: () => okAsync(usage.helpMinutes),
    homeworkAreaIds: (_owner, childProfileId, limit) =>
      okAsync(
        [
          ...new Set(
            [...sessions.values()]
              .filter((s) => s.childProfileId === childProfileId && s.topic.opening === null)
              .map((s) => s.topic.areaId)
              .filter((areaId) => areaId !== null),
          ),
        ].slice(0, limit),
      ),
    loadSession: (ref, includeCompleted = false) => {
      const stored = sessions.get(ref.sessionId);
      const session =
        includeCompleted &&
        stored?.status === 'completed' &&
        stored.childProfileId === ref.childProfileId
          ? stored
          : active(ref.childProfileId, ref.sessionId);
      return session === null ? errAsync(notFound()) : okAsync(session);
    },
    load: (ref) => repository.loadSession(ref).map(toLadderState),
    recordHint: (ref, hint, after) => {
      const session = active(ref.childProfileId, ref.sessionId);
      if (session === null) {
        return errAsync(notFound());
      }
      // A twin under the same id, or a hint recorded since the state `after` names, wins.
      const latest = session.hints.at(-1)?.requestId ?? null;
      if (session.hints.some((given) => given.requestId === hint.requestId) || latest !== after) {
        return okAsync('duplicate');
      }
      const level = session.hintLevel;
      sessions.set(session.id, {
        ...session,
        // The level only ever goes up, as in the database.
        hintLevel:
          level !== null && HINT_LEVELS.indexOf(level) > HINT_LEVELS.indexOf(hint.level)
            ? level
            : hint.level,
        hints: [...session.hints, hint],
      });
      return okAsync('recorded');
    },
    recordAnswerCheck: (ref, check) => {
      const session = active(ref.childProfileId, ref.sessionId);
      if (session === null) {
        return errAsync(notFound());
      }
      if (session.answerChecks.some((stored) => stored.requestId === check.requestId)) {
        return okAsync('duplicate');
      }
      const step = {
        ...check,
        hintLevel: session.hintLevel,
        question: check.question === null ? null : { text: check.question.text, reply: null },
        occurredAt: UPDATED_AT,
      };
      sessions.set(session.id, { ...session, answerChecks: [...session.answerChecks, step] });
      return okAsync('recorded');
    },
    recordComprehensionReply: (ref, reply) => {
      const session = active(ref.childProfileId, ref.sessionId);
      if (session === null) {
        return errAsync(notFound());
      }
      replies.push({ completes: reply.completes, text: reply.text });
      sessions.set(session.id, {
        ...session,
        status: reply.completes ? 'completed' : 'active',
        answerChecks: session.answerChecks.map((check) =>
          check.requestId === reply.check.requestId && check.question !== null
            ? { ...check, question: { ...check.question, reply: reply.text } }
            : check,
        ),
      });
      return okAsync('recorded');
    },
  };
  return { repository, sessions, starts, replies, usage };
}

/** The dependencies of the session use cases over the in-memory store, signed in as `actor`. */
export function helpSessionDependencies(
  repository: HelpSessionRepository,
  actor: Actor = parent(),
  rateLimiter: RateLimiter = createTestRateLimiter(),
  assignments: ReturnType<typeof fakeAssignments> = fakeAssignments(),
  classifier?: TopicClassifier,
  childProfiles: ChildProfileAccess = ownChildren(),
): {
  readonly deps: HelpSessionDependencies;
  readonly events: ReturnType<typeof recordingAuditLog>['events'];
} {
  const { audit, events } = recordingAuditLog();
  return {
    deps: {
      authorization: createAuthorizationService({
        currentActor: signedInAs(actor),
        audit: recordingSecurityAudit(),
      }),
      childProfiles,
      rateLimiter,
      assignments: assignments.access,
      sessions: repository,
      audit,
      competencies: fakeCompetencies().retrieval,
      ...(classifier === undefined ? {} : { classifier }),
    },
    events,
  };
}

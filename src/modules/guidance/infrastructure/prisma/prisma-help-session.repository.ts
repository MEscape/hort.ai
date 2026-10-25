import type { Clock } from '@lib/clock';
import { createPersistenceFailures, dateToInstant, db, rollbackWith } from '@lib/db';
import { conflictError } from '@lib/errors';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { GUIDANCE_ERROR_CODES } from '../../domain/errors/guidance-errors';
import {
  HELP_SESSION_STEP_LIMIT,
  isSameTask,
  toLadderState,
} from '../../domain/models/help-session';
import { toHelpSessionId } from '../../domain/models/ids';

import {
  duplicateOnConflict,
  findHomeworkAreaIds,
  runStep,
  sessionNotFound,
  settleStep,
  storeFailed,
} from './help-session-ownership';
import {
  ANSWER_SELECT,
  ASSESSED_BY_RECORD,
  ASSESSMENT_SELECT,
  HINT_SELECT,
  LEVEL_RECORD,
  QUESTION_SELECT,
  RESULT_RECORD,
  SESSION_SELECT,
  STATUS_RECORD,
  SUBJECT_RECORD,
  raisedLevel,
  toTopicRecord,
  toHelpSession,
} from './help-session-record-mapper';
import { loadLearningActivity } from './learning-activity.repository';

import type { HelpSession } from '../../domain/models/help-session';
import type {
  HelpSessionOwner,
  HelpSessionRepository,
  NewHelpSession,
} from '../../domain/ports/help-session.repository';
import type {
  HelpSessionRef,
  HintSessionStoreError as HelpSessionLoadError,
} from '../../domain/ports/hint-session-store.port';

const failures = createPersistenceFailures({
  module: 'guidance.persistence',
  code: GUIDANCE_ERROR_CODES.sessionStoreFailed,
  subject: 'HelpSession',
});

/** Only seen inside this file: a unique index refused a repeat, which is an expected outcome. */
const alreadyStored = () => conflictError('guidance.step_already_stored', 'Already stored.');

/**
 * Prisma-backed help sessions, the only place that touches `db` for them. Every query names the
 * tenant, the owner and the child; step rows are reached only through a session pinned that way.
 * A step's request id is unique per session, so a repeat stores nothing.
 */
export class PrismaHelpSessionRepository implements HelpSessionRepository {
  constructor(private readonly clock: Clock) {}

  start: HelpSessionRepository['start'] = (owner, session) => this.create(owner, session, true);

  /** `retake`: whether a refused start may end the session that holds the child's slot, once. */
  private create(
    owner: HelpSessionOwner,
    session: NewHelpSession,
    retake: boolean,
  ): ReturnType<HelpSessionRepository['start']> {
    const now = dateToInstant(this.clock.now());
    return fromThrowableAsync(
      () =>
        db.transaction(async (tx) => {
          if (session.replaces !== null) {
            await tx.orm.public.HelpSession.where({
              id: session.replaces,
              tenantId: owner.tenantId,
              ownerId: owner.ownerId,
              childProfileId: session.childProfileId,
              status: STATUS_RECORD.active,
            }).updateAndCount({ status: STATUS_RECORD.abandoned, endedAt: now, updatedAt: now });
          }
          return tx.orm.public.HelpSession.select('id').create({
            tenantId: owner.tenantId,
            ownerId: owner.ownerId,
            childProfileId: session.childProfileId,
            assignmentId: session.assignmentId,
            taskText: session.task,
            subject: SUBJECT_RECORD[session.subject],
            ...toTopicRecord(session.topic),
            startedAt: now,
            updatedAt: now,
          });
        }),
      failures.orConflict('start', alreadyStored),
    )
      .andThen(({ id }) =>
        this.read({
          ...owner,
          childProfileId: session.childProfileId,
          sessionId: toHelpSessionId(id),
        }).map((created) => ({
          session: created,
          created: true,
        })),
      )
      .orElse((error) => {
        if (error.kind === 'not_found') {
          return errAsync(storeFailed('start'));
        }
        if (error.kind !== 'conflict') {
          return errAsync(error);
        }
        // The one-active-per-child index refused. A twin start of the same task won: its session
        // is the answer. Another task opened meanwhile is ended once, as `replaces` would have.
        return this.findOpen(owner, session.childProfileId).andThen((open) => {
          if (open !== null && isSameTask(open, session)) {
            return okAsync({ session: open, created: false });
          }
          return retake
            ? this.create(owner, { ...session, replaces: open?.id ?? null }, false)
            : errAsync(storeFailed('start'));
        });
      });
  }

  findOpen: HelpSessionRepository['findOpen'] = (owner, childProfileId) =>
    fromThrowableAsync(
      async () =>
        db.orm.public.HelpSession.select('id')
          .where({
            tenantId: owner.tenantId,
            ownerId: owner.ownerId,
            childProfileId,
            status: STATUS_RECORD.active,
          })
          .first(),
      failures.infraOnly('findOpen'),
    ).andThen((row) =>
      row === null
        ? okAsync(null)
        : this.read({ ...owner, childProfileId, sessionId: toHelpSessionId(row.id) }).orElse(
            (error) =>
              // Ended between the two reads: there is no open session any more.
              error.kind === 'not_found' ? okAsync(null) : errAsync(error),
          ),
    );

  learningActivity: HelpSessionRepository['learningActivity'] = loadLearningActivity;

  homeworkAreaIds: HelpSessionRepository['homeworkAreaIds'] = (...scope) =>
    fromThrowableAsync(() => findHomeworkAreaIds(...scope), failures.infraOnly('homeworkAreaIds'));

  loadSession: HelpSessionRepository['loadSession'] = (ref, includeCompleted = false) =>
    this.read(ref, includeCompleted);

  load: HelpSessionRepository['load'] = (ref) => this.loadSession(ref).map(toLadderState);

  recordHint: HelpSessionRepository['recordHint'] = (ref, hint, after) =>
    fromThrowableAsync(
      () =>
        runStep(this.clock, ref, async (tx, locked) => {
          // @owner-scope child The session was locked with tenant, owner and child in this transaction.
          const latest = await tx.orm.public.HintEvent.where({ sessionId: ref.sessionId })
            .select('idempotencyKey')
            .orderBy([(row) => row.occurredAt.desc(), (row) => row.id.desc()])
            .first();
          if ((latest?.idempotencyKey ?? null) !== after) {
            // Another hint was recorded since this one's level was decided: that one took the rung.
            rollbackWith('duplicate');
          }
          // @owner-scope child The session was locked with tenant, owner and child in this transaction.
          await tx.orm.public.HintEvent.create({
            sessionId: ref.sessionId,
            idempotencyKey: hint.requestId,
            level: LEVEL_RECORD[hint.level],
            text: hint.kind === 'generated' ? hint.text : null,
            fallbackReason: hint.kind === 'fallback' ? hint.reason : null,
            competencyCode: locked.competencyCode,
            occurredAt: dateToInstant(this.clock.now()),
          });
          return {
            currentHintLevel: raisedLevel(locked.currentHintLevel, LEVEL_RECORD[hint.level]),
          };
        }),
      failures.orConflict('recordHint', alreadyStored),
    )
      .andThen(settleStep)
      .orElse(duplicateOnConflict);

  recordAnswerCheck: HelpSessionRepository['recordAnswerCheck'] = (ref, check) =>
    fromThrowableAsync(
      () =>
        runStep(this.clock, ref, async (tx, locked) => {
          const occurredAt = dateToInstant(this.clock.now());
          const key = { sessionId: ref.sessionId, idempotencyKey: check.requestId };
          // @owner-scope child The session was locked with tenant, owner and child in this transaction.
          const answer = await tx.orm.public.ChildAnswer.select('id').create({
            ...key,
            text: check.answer,
            occurredAt,
          });
          // @owner-scope child The answer was just written in the locked session.
          await tx.orm.public.AnswerAssessment.create({
            ...key,
            answerId: answer.id,
            result: check.result === null ? null : RESULT_RECORD[check.result],
            assessedBy: check.assessedBy === null ? null : ASSESSED_BY_RECORD[check.assessedBy],
            hintLevel: locked.currentHintLevel,
            text: check.feedbackText,
            occurredAt,
          });
          if (check.question !== null) {
            // @owner-scope child The session was locked with tenant, owner and child in this transaction.
            await tx.orm.public.ComprehensionQuestion.create({
              ...key,
              text: check.question.text,
              occurredAt,
            });
          }
          return {};
        }),
      failures.orConflict('recordAnswerCheck', alreadyStored),
    )
      .andThen(settleStep)
      .orElse(duplicateOnConflict);

  recordComprehensionReply: HelpSessionRepository['recordComprehensionReply'] = (ref, reply) =>
    fromThrowableAsync(
      () =>
        runStep(this.clock, ref, async (tx) => {
          const now = dateToInstant(this.clock.now());
          // @owner-scope child The session was locked with tenant, owner and child in this transaction.
          const answered = await tx.orm.public.ComprehensionQuestion.where({
            sessionId: ref.sessionId,
            idempotencyKey: reply.check.requestId,
          })
            .where((row) => row.replyText.isNull())
            .updateAndCount({ replyText: reply.text, repliedAt: now });
          if (answered === 0) {
            // Answered in the meantime: undo the session touch, so a repeat changes nothing.
            rollbackWith('duplicate');
          }
          return reply.completes ? { status: STATUS_RECORD.completed, endedAt: now } : {};
        }),
      failures.orConflict('recordComprehensionReply', alreadyStored),
    )
      .andThen(settleStep)
      .orElse(duplicateOnConflict);

  /** The whole active session, its latest steps oldest first; an ended or foreign one is not found. */
  private read(
    ref: HelpSessionRef,
    includeCompleted = false,
  ): AppResultAsync<HelpSession, HelpSessionLoadError> {
    const { tenantId, ownerId, childProfileId, sessionId } = ref;
    return fromThrowableAsync(async () => {
      // @owner-scope actor Exact tenant, parent, child and session on completion recovery too.
      const session = await db.orm.public.HelpSession.where({
        id: sessionId,
        tenantId,
        ownerId,
        childProfileId,
      })
        .select(...SESSION_SELECT)
        .first();
      if (
        session === null ||
        (session.status !== STATUS_RECORD.active &&
          !(includeCompleted && session.status === STATUS_RECORD.completed))
      ) {
        return null;
      }
      const scope = { sessionId };
      const [hints, answers, questions] = await Promise.all([
        // @owner-scope derived The session was read above with tenant, owner and child.
        db.orm.public.HintEvent.where(scope)
          .select(...HINT_SELECT)
          .orderBy([(row) => row.occurredAt.desc(), (row) => row.id.desc()])
          .limit(HELP_SESSION_STEP_LIMIT)
          .all(),
        // @owner-scope derived The session was read above with tenant, owner and child.
        db.orm.public.ChildAnswer.where(scope)
          .select(...ANSWER_SELECT)
          .include('assessment', (assessment) => assessment.select(...ASSESSMENT_SELECT))
          .orderBy([(row) => row.occurredAt.desc(), (row) => row.id.desc()])
          .limit(HELP_SESSION_STEP_LIMIT)
          .all(),
        // @owner-scope derived The session was read above with tenant, owner and child.
        db.orm.public.ComprehensionQuestion.where(scope)
          .select(...QUESTION_SELECT)
          .orderBy([(row) => row.occurredAt.desc(), (row) => row.id.desc()])
          .limit(HELP_SESSION_STEP_LIMIT)
          .all(),
      ]);
      return {
        session: toHelpSession({
          session,
          hints: hints.reverse(),
          answers: answers.reverse(),
          questions,
        }),
      };
    }, failures.infraOnly('read')).andThen((found) => {
      if (found === null) {
        return errAsync(sessionNotFound());
      }
      return found.session === null ? errAsync(storeFailed('read')) : okAsync(found.session);
    });
  }
}

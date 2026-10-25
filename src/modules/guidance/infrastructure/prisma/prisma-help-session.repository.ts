import type { Clock } from '@lib/clock';
import { createPersistenceFailures, dateToInstant, db, rollbackWith, rollbackable } from '@lib/db';
import type { Rollbackable } from '@lib/db';
import { conflictError, infrastructureError, notFoundError } from '@lib/errors';
import type { ConflictAppError, InfrastructureAppError } from '@lib/errors';
import { errAsync, fromThrowableAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { GUIDANCE_ERROR_CODES } from '../../domain/errors/guidance-errors';
import { HELP_SESSION_STEP_LIMIT, toLadderState } from '../../domain/models/help-session';
import { toHelpSessionId } from '../../domain/models/ids';

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
  toHelpSession,
} from './help-session-record-mapper';

import type { LevelValue } from './help-session-record-mapper';
import type { HelpSession } from '../../domain/models/help-session';
import type { ChildProfileId, HelpSessionId } from '../../domain/models/ids';
import type {
  HelpSessionOwner,
  HelpSessionRepository,
} from '../../domain/ports/help-session.repository';
import type {
  HelpSessionRef,
  HintSessionStoreError as HelpSessionLoadError,
  RecordOutcome as StepOutcome,
} from '../../domain/ports/hint-session-store.port';

const failures = createPersistenceFailures({
  module: 'guidance.persistence',
  code: GUIDANCE_ERROR_CODES.sessionStoreFailed,
  subject: 'HelpSession',
});

/** Only seen inside this file: a unique index refused a repeat, which is an expected outcome. */
const alreadyStored = () => conflictError('guidance.step_already_stored', 'Already stored.');

const sessionNotFound = () =>
  notFoundError(GUIDANCE_ERROR_CODES.sessionNotFound, 'The help session was not found.');

/** Rows that break the contract, or a session that vanished mid-operation: logged, never shown half. */
const storeFailed = (operation: string): InfrastructureAppError =>
  infrastructureError(
    GUIDANCE_ERROR_CODES.sessionStoreFailed,
    `HelpSession persistence failed during ${operation}.`,
    undefined,
  );

type Database = Pick<typeof db, 'orm'>;

/** The one active session `ref` names, pinned to its tenant, owner and child. */
const activeSession = (database: Database, ref: HelpSessionRef) =>
  database.orm.public.HelpSession.where({
    id: ref.sessionId,
    tenantId: ref.tenantId,
    ownerId: ref.ownerId,
    childProfileId: ref.childProfileId,
    status: STATUS_RECORD.active,
  });

/** A repeat (`conflict`) is the duplicate outcome; anything else stays a failure. */
const duplicateOnConflict = (
  error: HelpSessionLoadError | ConflictAppError,
): AppResultAsync<StepOutcome, HelpSessionLoadError> =>
  error.kind === 'conflict' ? okAsync('duplicate') : errAsync(error);

/** How a step's transaction ended: a refusal rolled back with `rollbackWith` is a duplicate. */
type StepEnd = Rollbackable<'recorded' | 'missing', 'duplicate'>;

const settleStep = (ended: StepEnd): AppResultAsync<StepOutcome, HelpSessionLoadError> => {
  if (ended.kind === 'rolled-back') {
    return okAsync(ended.refusal);
  }
  return ended.value === 'missing' ? errAsync(sessionNotFound()) : okAsync('recorded');
};

/** What a step writes, given the locked session; it returns the session columns it moves on. */
type StepWrite = (
  tx: Database,
  locked: { readonly version: number; readonly currentHintLevel: LevelValue | null },
) => Promise<Record<string, unknown>>;

/**
 * One step in one transaction: lock the active session (an ended or foreign one is not found),
 * write the step, then move the session on with what the step returns and a new version. A
 * repeated request id hits the unique index, so the whole transaction rolls back and the caller
 * maps the conflict to `duplicate`.
 */
function runStep(clock: Clock, ref: HelpSessionRef, write: StepWrite): Promise<StepEnd> {
  return rollbackable(() =>
    db.transaction(async (tx) => {
      const locked = await activeSession(tx, ref)
        .select('version', 'currentHintLevel')
        .update({ updatedAt: dateToInstant(clock.now()) });
      if (locked === null) {
        return 'missing' as const;
      }
      const moved = await write(tx, locked);
      await activeSession(tx, ref).updateAndCount({ ...moved, version: locked.version + 1 });
      return 'recorded' as const;
    }),
  );
}

/**
 * Prisma-backed help sessions, the only place that touches `db` for them. Every query names the
 * tenant, the owner and the child; step rows are reached only through a session pinned that way.
 * A step's request id is unique per session, so a repeat stores nothing.
 */
export class PrismaHelpSessionRepository implements HelpSessionRepository {
  constructor(private readonly clock: Clock) {}

  start: HelpSessionRepository['start'] = (owner, session) => {
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
            startedAt: now,
            updatedAt: now,
          });
        }),
      failures.orConflict('start', alreadyStored),
    )
      .andThen(({ id }) =>
        this.read(owner, session.childProfileId, toHelpSessionId(id)).map((created) => ({
          session: created,
          created: true,
        })),
      )
      .orElse((error) => {
        if (error.kind === 'not_found') {
          return errAsync(storeFailed('start'));
        }
        // A twin start won the one-active-per-child index: its session is the answer.
        return error.kind === 'conflict'
          ? this.findOpen(owner, session.childProfileId).andThen((open) =>
              open === null
                ? errAsync(storeFailed('start'))
                : okAsync({ session: open, created: false }),
            )
          : errAsync(error);
      });
  };

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
        : this.read(owner, childProfileId, toHelpSessionId(row.id)).orElse((error) =>
            // Ended between the two reads: there is no open session any more.
            error.kind === 'not_found' ? okAsync(null) : errAsync(error),
          ),
    );

  loadSession: HelpSessionRepository['loadSession'] = (ref) =>
    this.read(ref, ref.childProfileId, ref.sessionId);

  load: HelpSessionRepository['load'] = (ref) => this.loadSession(ref).map(toLadderState);

  recordHint: HelpSessionRepository['recordHint'] = (ref, hint) =>
    fromThrowableAsync(
      () =>
        runStep(this.clock, ref, async (tx) => {
          // @owner-scope child The session was locked with tenant, owner and child in this transaction.
          await tx.orm.public.HintEvent.create({
            sessionId: ref.sessionId,
            idempotencyKey: hint.requestId,
            level: LEVEL_RECORD[hint.level],
            text: hint.kind === 'generated' ? hint.text : null,
            fallbackReason: hint.kind === 'fallback' ? hint.reason : null,
            occurredAt: dateToInstant(this.clock.now()),
          });
          return { currentHintLevel: LEVEL_RECORD[hint.level] };
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
    owner: HelpSessionOwner,
    childProfileId: ChildProfileId,
    sessionId: HelpSessionId,
  ): AppResultAsync<HelpSession, HelpSessionLoadError> {
    return fromThrowableAsync(async () => {
      const session = await activeSession(db, { ...owner, childProfileId, sessionId })
        .select(...SESSION_SELECT)
        .first();
      if (session === null) {
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

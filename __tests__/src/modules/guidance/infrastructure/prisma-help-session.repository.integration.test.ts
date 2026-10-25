// @vitest-environment node
import { createHash } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { toActorId, toTenantId } from '@modules/auth/domain/models/ids';
import type { ActorId, TenantId } from '@modules/auth/domain/models/ids';
import {
  parseAssignmentTaskText,
  parseChildTaskText,
} from '@modules/guidance/domain/models/child-task-text';
import type { ChildTaskText } from '@modules/guidance/domain/models/child-task-text';
import type { HintLevel } from '@modules/guidance/domain/models/hint-level';
import {
  toAssignmentId,
  toChildProfileId,
  toHelpSessionId,
  toStepRequestId,
} from '@modules/guidance/domain/models/ids';
import type { HelpSessionRepository } from '@modules/guidance/domain/ports/help-session.repository';
import type { HelpSessionRef } from '@modules/guidance/domain/ports/hint-session-store.port';
import { UNCLASSIFIED_TOPIC } from '@modules/guidance/domain/topic/session-topic';

import type { db as Db, dateToInstant as DateToInstant } from '@lib/db';

/**
 * The Prisma adapter against the real help-session tables: the local Postgres after
 * `npm run db:migrate` (CI migrates its own). Skipped without a `DATABASE_URL`. It needs the
 * migration `add_help_session_steps`. Every test writes under a tenant of its own; the run removes
 * the profiles it made, whose delete cascades to their sessions and steps.
 */
const isEnabled = Boolean(process.env['DATABASE_URL']);

const START = Date.parse('2026-10-25T08:00:00.000Z');

/** One second later on every read, so steps are ordered by time as in real use. */
function advancingClock() {
  let tick = 0;
  return {
    now: () => {
      tick += 1;
      return new Date(START + tick * 1000);
    },
  };
}

function text(raw: string): ChildTaskText {
  return parseChildTaskText(raw)._unsafeUnwrap();
}

describe.skipIf(!isEnabled)('PrismaHelpSessionRepository against Postgres', () => {
  const runId = `it-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const used: TenantId[] = [];
  let sequence = 0;

  let repository: HelpSessionRepository;
  let db: typeof Db;
  let toInstant: typeof DateToInstant;
  let disconnect: () => Promise<void>;

  /** A parent with one finished child profile in a tenant of its own. */
  async function freshChild() {
    sequence += 1;
    const tenantId = toTenantId(`${runId}-${String(sequence)}`);
    const ownerId: ActorId = toActorId('parent-1');
    used.push(tenantId);
    const child = await db.orm.public.ChildProfile.create({
      tenantId,
      ownerId,
      displayName: 'Lisa',
      federalState: 'BY',
      grade: 2,
    });
    return { owner: { tenantId, ownerId }, childProfileId: toChildProfileId(child.id) };
  }

  async function started() {
    const { owner, childProfileId } = await freshChild();
    const { session } = (
      await repository.start(owner, {
        childProfileId,
        assignmentId: null,
        task: text('Rechne 23 + 19.'),
        subject: 'math',
        replaces: null,
        topic: UNCLASSIFIED_TOPIC,
      })
    )._unsafeUnwrap();
    const ref: HelpSessionRef = { ...owner, childProfileId, sessionId: session.id };
    return { owner, childProfileId, ref };
  }

  beforeAll(async () => {
    const database = await import('@lib/db');
    const { PrismaHelpSessionRepository } =
      await import('@modules/guidance/infrastructure/prisma/prisma-help-session.repository');
    db = database.db;
    toInstant = database.dateToInstant;
    disconnect = database.disconnectDb;
    repository = new PrismaHelpSessionRepository(advancingClock());
  });

  afterAll(async () => {
    for (const tenantId of used) {
      await db.orm.public.ChildProfile.where({ tenantId }).deleteAndCount();
    }
    await disconnect();
  });

  it('stores the topic classification of a new session (#92)', async () => {
    const { owner, childProfileId } = await freshChild();
    const topic = {
      intent: 'small_talk',
      opening: { kind: 'redirect', intent: 'small_talk' },
      competencyCode: null,
      openTopicLabel: null,
      classifiedBy: 'jev',
      areaId: 'zahlenwald',
      placeId: 'plus-mulde',
    } as const;

    const { session } = (
      await repository.start(owner, {
        childProfileId,
        assignmentId: null,
        task: text('Hallo Max, wie geht es dir?'),
        subject: 'math',
        replaces: null,
        topic,
      })
    )._unsafeUnwrap();

    expect(session.topic).toEqual(topic);
    expect((await repository.findOpen(owner, childProfileId))._unsafeUnwrap()?.topic).toEqual(
      topic,
    );
  });

  it('saves every step and reloads exactly the same state', async () => {
    const { owner, childProfileId, ref } = await started();

    await repository.recordHint(
      ref,
      {
        requestId: toStepRequestId('hint-1'),
        level: 'understand_task',
        kind: 'generated',
        text: 'Was sollst du herausfinden?',
      },
      null,
    );
    await repository.recordHint(
      ref,
      {
        requestId: toStepRequestId('hint-2'),
        level: 'next_step',
        kind: 'fallback',
        reason: 'timeout',
      },
      toStepRequestId('hint-1'),
    );
    await repository.recordAnswerCheck(ref, {
      requestId: toStepRequestId('check-1'),
      answer: text('41'),
      result: 'not_yet',
      assessedBy: 'ai',
      feedbackText: null,
      question: null,
    });
    await repository.recordAnswerCheck(ref, {
      requestId: toStepRequestId('check-2'),
      answer: text('42'),
      result: 'correct',
      assessedBy: 'solution_key',
      feedbackText: 'Super, du hast die Einer zuerst addiert.',
      question: { text: null },
    });

    const loaded = (await repository.loadSession(ref))._unsafeUnwrap();
    const open = (await repository.findOpen(owner, childProfileId))._unsafeUnwrap();
    const ladder = (await repository.load(ref))._unsafeUnwrap();

    expect(open).toEqual(loaded);
    expect(ladder).toEqual({
      task: 'Rechne 23 + 19.',
      assignmentId: null,
      subject: 'math',
      competencyCode: null,
      opening: null,
      hints: loaded.hints,
      answers: ['not_yet', 'correct'],
    });
    expect(loaded).toMatchObject({
      id: ref.sessionId,
      task: 'Rechne 23 + 19.',
      subject: 'math',
      status: 'active',
      hintLevel: 'next_step',
      hints: [
        { requestId: toStepRequestId('hint-1'), level: 'understand_task', kind: 'generated' },
        {
          requestId: toStepRequestId('hint-2'),
          level: 'next_step',
          kind: 'fallback',
          reason: 'timeout',
        },
      ],
      answerChecks: [
        {
          requestId: toStepRequestId('check-1'),
          result: 'not_yet',
          hintLevel: 'next_step',
          question: null,
        },
        {
          requestId: toStepRequestId('check-2'),
          result: 'correct',
          assessedBy: 'solution_key',
          question: { text: null, reply: null },
        },
      ],
    });
  });

  it('stores a repeated step once', async () => {
    const { ref } = await started();
    const hint = {
      requestId: toStepRequestId('hint-1'),
      level: 'understand_task',
      kind: 'generated',
      text: 'Lies die Aufgabe noch einmal.',
    } as const;
    const check = {
      requestId: toStepRequestId('check-1'),
      answer: text('42'),
      result: null,
      assessedBy: null,
      feedbackText: null,
      question: null,
    } as const;

    expect((await repository.recordHint(ref, hint, null))._unsafeUnwrap()).toBe('recorded');
    expect((await repository.recordHint(ref, hint, null))._unsafeUnwrap()).toBe('duplicate');
    expect((await repository.recordAnswerCheck(ref, check))._unsafeUnwrap()).toBe('recorded');
    expect((await repository.recordAnswerCheck(ref, check))._unsafeUnwrap()).toBe('duplicate');

    const loaded = (await repository.loadSession(ref))._unsafeUnwrap();
    expect(loaded.hints).toHaveLength(1);
    expect(loaded.answerChecks).toEqual([
      expect.objectContaining({ result: null, assessedBy: null, hintLevel: 'understand_task' }),
    ]);
  });

  it('stores the comprehension reply once and ends the session when it completes', async () => {
    const { owner, childProfileId, ref } = await started();
    await repository.recordAnswerCheck(ref, {
      requestId: toStepRequestId('check-1'),
      answer: text('42'),
      result: 'correct',
      assessedBy: 'ai',
      feedbackText: null,
      question: { text: 'Wie hast du gerechnet?' },
    });
    const [check] = (await repository.loadSession(ref))._unsafeUnwrap().answerChecks;
    if (check === undefined) {
      throw new Error('the check was not stored');
    }
    const reply = { check, text: text('Erst die Zehner.'), completes: true };

    expect((await repository.recordComprehensionReply(ref, reply))._unsafeUnwrap()).toBe(
      'recorded',
    );

    // Completed: no longer open, and a repeat finds no active session.
    expect((await repository.findOpen(owner, childProfileId))._unsafeUnwrap()).toBeNull();
    expect(
      (await repository.recordComprehensionReply(ref, reply))._unsafeUnwrapErr(),
    ).toMatchObject({ kind: 'not_found', code: 'guidance.session_not_found' });
    const stored = await db.orm.public.ComprehensionQuestion.where({ sessionId: ref.sessionId })
      .select('replyText')
      .all();
    expect(stored).toEqual([{ replyText: 'Erst die Zehner.' }]);
  });

  it('answers a reply to an already answered question as a duplicate', async () => {
    const { ref } = await started();
    await repository.recordAnswerCheck(ref, {
      requestId: toStepRequestId('check-1'),
      answer: text('42'),
      result: 'correct',
      assessedBy: 'ai',
      feedbackText: null,
      question: { text: null },
    });
    const [check] = (await repository.loadSession(ref))._unsafeUnwrap().answerChecks;
    if (check === undefined) {
      throw new Error('the check was not stored');
    }
    const reply = { check, text: text('Erst die Zehner.'), completes: false };

    await repository.recordComprehensionReply(ref, reply);
    const again = await repository.recordComprehensionReply(ref, {
      ...reply,
      text: text('Anders.'),
    });

    expect(again._unsafeUnwrap()).toBe('duplicate');
    const loaded = (await repository.loadSession(ref))._unsafeUnwrap();
    expect(loaded.answerChecks[0]?.question).toEqual({ text: null, reply: 'Erst die Zehner.' });
  });

  it("treats another parent's session like a missing one", async () => {
    const { ref } = await started();
    const foreign = { ...ref, ownerId: toActorId('parent-2') };

    expect((await repository.loadSession(foreign))._unsafeUnwrapErr()).toMatchObject({
      kind: 'not_found',
    });
    expect(
      (
        await repository.recordHint(
          foreign,
          {
            requestId: toStepRequestId('hint-1'),
            level: 'understand_task',
            kind: 'fallback',
            reason: 'timeout',
          },
          null,
        )
      )._unsafeUnwrapErr(),
    ).toMatchObject({ kind: 'not_found' });
    expect(
      (
        await repository.loadSession({ ...ref, sessionId: toHelpSessionId('missing') })
      )._unsafeUnwrapErr(),
    ).toMatchObject({ kind: 'not_found' });
  });

  it('lists the distinct islands of sessions that opened as help, for this child only', async () => {
    const { owner, childProfileId } = await freshChild();
    const other = await freshChild();
    const startOn = async (
      who: { readonly owner: typeof owner; readonly childProfileId: typeof childProfileId },
      taskText: string,
      topic: typeof UNCLASSIFIED_TOPIC,
      replaces: ReturnType<typeof toHelpSessionId> | null = null,
    ) =>
      (
        await repository.start(who.owner, {
          childProfileId: who.childProfileId,
          assignmentId: null,
          task: text(taskText),
          subject: 'math',
          replaces,
          topic,
        })
      )._unsafeUnwrap().session.id;
    const help = (areaId: string) =>
      ({ ...UNCLASSIFIED_TOPIC, intent: 'homework', areaId }) as const;

    const first = await startOn({ owner, childProfileId }, 'Rechne 23 + 19.', help('zahlenwald'));
    const second = await startOn(
      { owner, childProfileId },
      'Rechne 50 - 8.',
      help('zahlenwald'),
      first,
    );
    const third = await startOn(
      { owner, childProfileId },
      'Hallo Max!',
      {
        ...help('maerchenwald'),
        intent: 'small_talk',
        opening: { kind: 'redirect', intent: 'small_talk' },
      },
      second,
    );
    await startOn({ owner, childProfileId }, 'Rechne 3 mal 4.', help('malmuehle'), third);
    await startOn(other, 'Rechne 1 + 1.', help('obstgarten'));

    const ids = (await repository.homeworkAreaIds(owner, childProfileId, 10))._unsafeUnwrap();

    expect([...ids].sort()).toEqual(['malmuehle', 'zahlenwald']);
    expect(
      (await repository.homeworkAreaIds(owner, childProfileId, 1))._unsafeUnwrap(),
    ).toHaveLength(1);
  });

  it('abandons the replaced session and keeps one active session per child', async () => {
    const { owner, childProfileId, ref } = await started();

    const next = (
      await repository.start(owner, {
        childProfileId,
        assignmentId: null,
        task: text('Rechne 50 - 8.'),
        subject: 'math',
        replaces: ref.sessionId,
        topic: UNCLASSIFIED_TOPIC,
      })
    )._unsafeUnwrap();

    expect(next.created).toBe(true);
    expect((await repository.loadSession(ref))._unsafeUnwrapErr()).toMatchObject({
      kind: 'not_found',
    });
    const rows = await db.orm.public.HelpSession.where({ childProfileId })
      .select('status')
      .orderBy((row) => row.startedAt.asc())
      .all();
    expect(rows.map((row) => row.status).sort()).toEqual(['ABANDONED', 'ACTIVE']);
  });

  it('returns the winner when two starts race', async () => {
    const { owner, childProfileId } = await freshChild();
    const start = () =>
      repository.start(owner, {
        childProfileId,
        assignmentId: null,
        task: text('Rechne 23 + 19.'),
        subject: 'math',
        replaces: null,
        topic: UNCLASSIFIED_TOPIC,
      });

    const [first, second] = await Promise.all([start(), start()]);

    const results = [first._unsafeUnwrap(), second._unsafeUnwrap()];
    expect(results.map((result) => result.created).sort()).toEqual([false, true]);
    expect(results[0]?.session.id).toBe(results[1]?.session.id);
  });

  it("stores the teacher's assignment a session is on, with its longer text, and never a key (#33)", async () => {
    const { owner, childProfileId } = await freshChild();
    const classroom = await db.orm.public.Classroom.create({
      tenantId: owner.tenantId,
      ownerId: toActorId('teacher-a'),
      name: 'Klasse 2a',
      federalState: 'BY',
      grade: 2,
      subject: 'MATH',
      // Unique per run: the hash is globally unique, and a crashed run leaves its row behind.
      inviteCodeHash: createHash('sha256').update(runId).digest('hex'),
    });
    const assignmentText =
      `Rechne die Aufgaben auf dem Blatt. ${'36 + 47 = ? '.repeat(150)}`.trim();
    const assignment = await db.orm.public.Assignment.create({
      tenantId: owner.tenantId,
      ownerId: toActorId('teacher-a'),
      classroomId: classroom.id,
      title: 'Plusaufgaben',
      taskText: assignmentText,
      solutionKey: '83',
    });

    const { session } = (
      await repository.start(owner, {
        childProfileId,
        assignmentId: toAssignmentId(assignment.id),
        task: parseAssignmentTaskText(assignmentText)._unsafeUnwrap(),
        subject: 'math',
        replaces: null,
        topic: UNCLASSIFIED_TOPIC,
      })
    )._unsafeUnwrap();

    const ref: HelpSessionRef = { ...owner, childProfileId, sessionId: session.id };
    const reloaded = (await repository.loadSession(ref))._unsafeUnwrap();
    expect(reloaded).toMatchObject({ assignmentId: assignment.id, task: assignmentText });
    expect((await repository.load(ref))._unsafeUnwrap().assignmentId).toBe(assignment.id);
    expect(JSON.stringify(reloaded)).not.toContain('"83"');
    await db.orm.public.Classroom.where({ id: classroom.id }).deleteAndCount();
  });

  const hintAt = (requestId: string, level: HintLevel) =>
    ({
      requestId: toStepRequestId(requestId),
      level,
      kind: 'generated',
      text: 'Lies genau.',
    }) as const;

  it('stores nothing for a step on a session that ended while the step waited for it', async () => {
    const { ref } = await started();
    let step: ReturnType<HelpSessionRepository['recordHint']> | undefined;

    // Another request ends the session and holds its row while the step starts.
    await db.transaction(async (tx) => {
      const now = toInstant(new Date());
      await tx.orm.public.HelpSession.where({ id: ref.sessionId }).updateAndCount({
        status: 'ABANDONED',
        endedAt: now,
        updatedAt: now,
      });
      step = repository.recordHint(ref, hintAt('hint-1', 'understand_task'), null);
      await new Promise((resolve) => setTimeout(resolve, 300));
    });

    expect((await step)?._unsafeUnwrapErr()).toMatchObject({
      kind: 'not_found',
      code: 'guidance.session_not_found',
    });
    const hints = await db.orm.public.HintEvent.where({ sessionId: ref.sessionId }).all();
    expect(hints).toEqual([]);
  });

  it('records a rung once when two hints were decided from the same state', async () => {
    const { ref } = await started();

    const first = await repository.recordHint(ref, hintAt('tab-1', 'understand_task'), null);
    const second = await repository.recordHint(ref, hintAt('tab-2', 'understand_task'), null);

    expect([first._unsafeUnwrap(), second._unsafeUnwrap()]).toEqual(['recorded', 'duplicate']);
    const loaded = (await repository.loadSession(ref))._unsafeUnwrap();
    expect(loaded.hints.map((hint) => hint.requestId)).toEqual(['tab-1']);
  });

  it('never lowers the hint level of the session', async () => {
    const { ref } = await started();

    await repository.recordHint(ref, hintAt('high', 'next_step'), null);
    await repository.recordHint(ref, hintAt('low', 'understand_task'), toStepRequestId('high'));

    expect((await repository.loadSession(ref))._unsafeUnwrap()).toMatchObject({
      hintLevel: 'next_step',
      hints: [{ level: 'next_step' }, { level: 'understand_task' }],
    });
  });

  it("stores the session's competency with every hint", async () => {
    const { owner, childProfileId } = await freshChild();
    const { session } = (
      await repository.start(owner, {
        childProfileId,
        assignmentId: null,
        task: text('Rechne 23 + 19.'),
        subject: 'math',
        replaces: null,
        topic: { ...UNCLASSIFIED_TOPIC, intent: 'homework', competencyCode: 'M2.4' },
      })
    )._unsafeUnwrap();

    await repository.recordHint(
      { ...owner, childProfileId, sessionId: session.id },
      hintAt('hint-1', 'understand_task'),
      null,
    );

    const stored = await db.orm.public.HintEvent.where({ sessionId: session.id })
      .select('competencyCode')
      .all();
    expect(stored).toEqual([{ competencyCode: 'M2.4' }]);
  });

  it('starts another task over an open one it did not know of, ending that one', async () => {
    const { owner, childProfileId, ref } = await started();

    const other = (
      await repository.start(owner, {
        childProfileId,
        assignmentId: null,
        task: text('Rechne 50 - 8.'),
        subject: 'math',
        replaces: null,
        topic: UNCLASSIFIED_TOPIC,
      })
    )._unsafeUnwrap();

    expect(other).toMatchObject({ created: true, session: { task: 'Rechne 50 - 8.' } });
    expect((await repository.loadSession(ref))._unsafeUnwrapErr()).toMatchObject({
      kind: 'not_found',
    });
  });

  it("counts the child's help minutes from the step times in the range, idle gaps capped", async () => {
    const clock = { current: new Date(START) };
    const timed = new (
      await import('@modules/guidance/infrastructure/prisma/prisma-help-session.repository')
    ).PrismaHelpSessionRepository({ now: () => clock.current });
    const at = (minute: number) => {
      clock.current = new Date(START + minute * 60_000);
    };
    const { owner, childProfileId } = await freshChild();
    at(0);
    const { session } = (
      await timed.start(owner, {
        childProfileId,
        assignmentId: null,
        task: text('Rechne 23 + 19.'),
        subject: 'math',
        replaces: null,
        topic: UNCLASSIFIED_TOPIC,
      })
    )._unsafeUnwrap();
    const ref = { ...owner, childProfileId, sessionId: session.id };
    at(2);
    await timed.recordHint(ref, hintAt('hint-1', 'understand_task'), null);
    at(30);
    await timed.recordAnswerCheck(ref, {
      requestId: toStepRequestId('check-1'),
      answer: text('42'),
      result: 'correct',
      assessedBy: 'ai',
      feedbackText: null,
      question: { text: null },
    });
    const [check] = (await timed.loadSession(ref))._unsafeUnwrap().answerChecks;
    at(33);
    if (check !== undefined) {
      await timed.recordComprehensionReply(ref, { check, text: text('Zehner.'), completes: true });
    }
    const hour = { from: new Date(START), to: new Date(START + 60 * 60_000) };

    // 1 for the start, 2 to the hint, 28 capped at 5 to the check, 3 to the reply.
    expect((await timed.helpMinutesBetween(owner, childProfileId, hour))._unsafeUnwrap()).toBe(11);
    expect(
      (
        await timed.helpMinutesBetween(owner, childProfileId, {
          ...hour,
          from: new Date(START + 60_000),
        })
      )._unsafeUnwrap(),
    ).toBe(9);
    expect(
      (
        await timed.helpMinutesBetween(
          { ...owner, ownerId: toActorId('parent-2') },
          childProfileId,
          hour,
        )
      )._unsafeUnwrap(),
    ).toBe(0);
  });
});

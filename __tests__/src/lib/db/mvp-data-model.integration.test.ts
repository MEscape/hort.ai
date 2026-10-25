// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { db as Db } from '@lib/db';

/**
 * The invariants of the MVP data model (#8) that only the database can guarantee, against the real
 * tables: the local Postgres after `npm run db:migrate` (CI migrates its own). Skipped without a
 * `DATABASE_URL`. Every row is written under a tenant of this run and removed afterwards.
 */
const isEnabled = Boolean(process.env['DATABASE_URL']);

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

describe.skipIf(!isEnabled)('MVP data model constraints against Postgres', () => {
  const tenantId = `it-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let db: typeof Db;
  let disconnect: () => Promise<void>;
  let sequence = 0;

  const unique = (prefix: string) => {
    sequence += 1;
    return `${prefix}${String(sequence)}`;
  };

  function childProfile() {
    return db.orm.public.ChildProfile.create({
      tenantId,
      ownerId: 'parent-1',
      displayName: 'Mia',
      federalState: 'HE',
      grade: 3,
    });
  }

  function classroom(inviteCodeHash: string) {
    return db.orm.public.Classroom.create({
      tenantId,
      ownerId: 'teacher-1',
      name: unique('Klasse 3'),
      federalState: 'HE',
      grade: 3,
      subject: 'MATH',
      inviteCodeHash,
    });
  }

  beforeAll(async () => {
    const database = await import('@lib/db');
    db = database.db;
    disconnect = database.disconnectDb;
  });

  afterAll(async () => {
    // Memberships, sessions and their events go with their parents (ON DELETE CASCADE).
    await db.orm.public.ChildProfile.where({ tenantId }).deleteAndCount();
    await db.orm.public.Classroom.where({ tenantId }).deleteAndCount();
    await disconnect();
  });

  it('defaults voice consent to off for a new child profile', async () => {
    const child = await childProfile();

    expect(child.voiceConsent).toBe(false);
  });

  it('refuses a second active class membership for the same child', async () => {
    const child = await childProfile();
    const first = await classroom(HASH_A);
    const second = await classroom(HASH_B);

    await db.orm.public.ClassMembership.create({
      tenantId,
      classroomId: first.id,
      childProfileId: child.id,
    });

    await expect(
      db.orm.public.ClassMembership.create({
        tenantId,
        classroomId: second.id,
        childProfileId: child.id,
      }),
    ).rejects.toThrow();
  });

  it('refuses a second session event with the same idempotency key', async () => {
    const child = await childProfile();
    const session = await db.orm.public.HelpSession.create({
      tenantId,
      ownerId: 'parent-1',
      childProfileId: child.id,
      taskText: 'Rechne 23 + 19.',
    });
    const event = {
      sessionId: session.id,
      idempotencyKey: 'step-1',
      level: 'UNDERSTAND_TASK',
      text: 'Was sollst du hier herausfinden?',
    } as const;

    await db.orm.public.HintEvent.create(event);

    await expect(db.orm.public.HintEvent.create(event)).rejects.toThrow();
    expect(await db.orm.public.HintEvent.where({ sessionId: session.id }).all()).toHaveLength(1);
  });

  it('accepts the same idempotency key in another session', async () => {
    const child = await childProfile();
    const sessions = await Promise.all(
      [1, 2].map(() =>
        db.orm.public.HelpSession.create({
          tenantId,
          ownerId: 'parent-1',
          childProfileId: child.id,
          taskText: 'Rechne 23 + 19.',
        }),
      ),
    );

    for (const session of sessions) {
      await db.orm.public.ChildAnswer.create({
        sessionId: session.id,
        idempotencyKey: 'answer-1',
        text: '42',
      });
    }

    expect(
      await db.orm.public.ChildAnswer.where({ idempotencyKey: 'answer-1' })
        .all()
        .then((rows) => rows.filter((row) => sessions.some((s) => s.id === row.sessionId))),
    ).toHaveLength(2);
  });

  it('refuses an assessment that points at an answer of another session', async () => {
    const child = await childProfile();
    const newSession = () =>
      db.orm.public.HelpSession.create({
        tenantId,
        ownerId: 'parent-1',
        childProfileId: child.id,
        taskText: 'Rechne 23 + 19.',
      });
    const own = await newSession();
    const foreign = await newSession();
    const answer = await db.orm.public.ChildAnswer.create({
      sessionId: foreign.id,
      idempotencyKey: 'answer-x',
      text: '42',
    });
    const assessment = {
      answerId: answer.id,
      idempotencyKey: 'assess-1',
      result: 'CORRECT',
      text: 'Stimmt, 23 + 19 = 42.',
    } as const;

    await expect(
      db.orm.public.AnswerAssessment.create({ ...assessment, sessionId: own.id }),
    ).rejects.toThrow(/AnswerAssessment_answerId_sessionId_fkey/);
    // The same row in the answer's own session is valid, so only the session mismatch was refused.
    await expect(
      db.orm.public.AnswerAssessment.create({ ...assessment, sessionId: foreign.id }),
    ).resolves.toMatchObject({ answerId: answer.id });
  });

  it('refuses a grade outside 1 to 4 even from a writer that skips the domain', async () => {
    await expect(
      db.orm.public.ChildProfile.create({
        tenantId,
        ownerId: 'parent-1',
        displayName: 'Mia',
        federalState: 'HE',
        grade: 7,
      }),
    ).rejects.toThrow();
  });

  it('makes an old invite code unusable once the class has a new one', async () => {
    const room = await classroom('c'.repeat(64));

    await db.orm.public.Classroom.where({ id: room.id }).update({ inviteCodeHash: 'd'.repeat(64) });

    expect(
      await db.orm.public.Classroom.where({ inviteCodeHash: 'c'.repeat(64) }).first(),
    ).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';

import { ReplyToComprehensionQuestion } from '@modules/guidance/application/commands/reply-to-comprehension-question';
import { toStepRequestId } from '@modules/guidance/domain/models/ids';

import { OWN_CHILD, task } from '../fakes';
import { helpSessionDependencies, inMemorySessions, storedSession } from '../help-session-fakes';

const awaitingReply = () =>
  storedSession({
    answerChecks: [
      {
        requestId: toStepRequestId('check-1'),
        answer: task('42'),
        result: 'correct',
        assessedBy: 'ai',
        hintLevel: 'next_step',
        feedbackText: null,
        question: { text: null, reply: null },
        occurredAt: new Date('2026-10-25T08:00:00.000Z'),
      },
    ],
  });

function build(sessions = [awaitingReply()]) {
  const store = inMemorySessions(sessions);
  const { deps, events } = helpSessionDependencies(store.repository);
  const rewards: string[] = [];
  const reward = {
    award: (_child: unknown, sessionId: string) => {
      rewards.push(sessionId);
      return Promise.resolve();
    },
  };
  const run = (reply: string) =>
    new ReplyToComprehensionQuestion({ ...deps, reward }).execute({
      childProfileId: OWN_CHILD,
      sessionId: 'session-1',
      reply,
    });
  return { store, events, rewards, run };
}

describe('ReplyToComprehensionQuestion honesty (the child answers in their own words)', () => {
  it.each([
    ['?'],
    ['??'],
    ['weiß nicht'],
    ['Keine Ahnung!'],
    ['idk'],
    ["I don't know."],
    ['...'],
    ['x'],
  ])(
    'asks again for %j instead of counting it as a reply, storing nothing and granting no XP',
    async (reply) => {
      const { run, store, rewards } = build();

      const result = await run(reply);

      expect(result.isErr() && result.error).toMatchObject({
        kind: 'validation',
        code: 'guidance.reply_not_an_answer',
      });
      expect(store.replies).toEqual([]);
      expect(rewards).toEqual([]);
    },
  );

  it.each([['Weil 2 + 3 fünf ist.'], ['7']])('counts a short real reply: %j', async (reply) => {
    const { run } = build();

    expect((await run(reply))._unsafeUnwrap()).toMatchObject({ status: 'understood' });
  });

  it('retries the idempotent reward when a completed session is replayed, so a failed grant is not lost', async () => {
    const { run, rewards } = build();

    await run('Erst die Zehner, dann die Einer.');
    const again = await run('Erst die Zehner, dann die Einer.');

    expect(again._unsafeUnwrap()).toEqual({ sessionId: 'session-1', status: 'understood' });
    expect(rewards).toEqual(['session-1', 'session-1']);
  });
});

describe('ReplyToComprehensionQuestion when the reply says the child may be in danger (#90)', () => {
  it('answers with the trusted-adult code, stores nothing, grants nothing and logs ids only', async () => {
    const { run, store, rewards, events } = build();

    const result = await run('Ich will nicht mehr leben.');

    expect(result.isErr() && result.error).toMatchObject({ code: 'guidance.child_distress' });
    expect(store.replies).toEqual([]);
    expect(rewards).toEqual([]);
    expect(events).toEqual([
      {
        type: 'guidance.child_distress_detected',
        tenantId: 'default',
        actorId: 'parent-1',
        childProfileId: 'child-1',
        sessionId: null,
        step: 'reply',
      },
    ]);
  });
});

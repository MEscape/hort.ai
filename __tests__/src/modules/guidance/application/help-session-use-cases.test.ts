import { describe, expect, it } from 'vitest';

import { TEACHER_ROLE } from '@modules/auth/domain/models/role';
import { ReplyToComprehensionQuestion } from '@modules/guidance/application/commands/reply-to-comprehension-question';
import { StartHelpSession } from '@modules/guidance/application/commands/start-help-session';
import { GetOpenHelpSession } from '@modules/guidance/application/queries/get-open-help-session';
import type { AnswerCheckStep } from '@modules/guidance/domain/models/help-session';
import { toStepRequestId } from '@modules/guidance/domain/models/ids';

import { parent } from '../../auth/fakes';
import { OTHER_CHILD, OWN_CHILD, task } from '../fakes';
import { helpSessionDependencies, inMemorySessions, storedSession } from '../help-session-fakes';

const TASK = 'Rechne 23 + 19.';

function check(overrides: Partial<AnswerCheckStep> = {}): AnswerCheckStep {
  return {
    requestId: toStepRequestId('check-1'),
    answer: task('42'),
    result: 'correct',
    assessedBy: 'ai',
    hintLevel: 'next_step',
    feedbackText: null,
    question: { text: null, reply: null },
    occurredAt: new Date('2026-10-25T08:00:00.000Z'),
    ...overrides,
  };
}

describe('StartHelpSession', () => {
  const start = (input: Partial<Parameters<StartHelpSession['execute']>[0]> = {}) => {
    const store = inMemorySessions();
    const { deps, events } = helpSessionDependencies(store.repository);
    return {
      store,
      events,
      run: (overrides = input) =>
        new StartHelpSession(deps).execute({
          childProfileId: OWN_CHILD,
          task: TASK,
          subject: 'math',
          ...overrides,
        }),
    };
  };

  it('starts a session for the own child and audits it with ids only', async () => {
    const { run, events } = start();

    const view = (await run())._unsafeUnwrap();

    expect(view).toMatchObject({
      outcome: 'started',
      session: { task: TASK, subject: 'math', status: 'working', hints: [], openQuestion: null },
    });
    expect(events).toEqual([
      {
        type: 'guidance.session_started',
        tenantId: parent().tenantId,
        actorId: parent().id,
        childProfileId: OWN_CHILD,
        sessionId: view.session.sessionId,
        subject: 'math',
        replaced: null,
      },
    ]);
    expect(JSON.stringify(events)).not.toContain(TASK);
  });

  it('continues the open session when the same task is started again', async () => {
    const store = inMemorySessions([storedSession()]);
    const { deps, events } = helpSessionDependencies(store.repository);

    const view = (
      await new StartHelpSession(deps).execute({
        childProfileId: OWN_CHILD,
        task: `  ${TASK}\r\n`,
        subject: 'math',
      })
    )._unsafeUnwrap();

    expect(view).toMatchObject({ outcome: 'continued', session: { sessionId: 'session-1' } });
    expect(store.starts).toEqual([]);
    expect(events).toEqual([]);
  });

  it('replaces the open session when another task is started', async () => {
    const store = inMemorySessions([storedSession()]);
    const { deps } = helpSessionDependencies(store.repository);

    const view = (
      await new StartHelpSession(deps).execute({
        childProfileId: OWN_CHILD,
        task: 'Rechne 50 - 8.',
        subject: 'math',
      })
    )._unsafeUnwrap();

    expect(view.outcome).toBe('started');
    expect(store.starts.map((s) => s.replaces)).toEqual(['session-1']);
    expect(store.sessions.get('session-1')?.status).toBe('abandoned');
  });

  it("refuses another parent's child before touching any session", async () => {
    const { run, store } = start();

    const error = (await run({ childProfileId: OTHER_CHILD }))._unsafeUnwrapErr();

    expect(error.kind).toBe('not_found');
    expect(store.starts).toEqual([]);
  });

  it('refuses an invalid subject or an empty task without storing anything', async () => {
    const { run, store } = start();

    expect((await run({ subject: 'magic' }))._unsafeUnwrapErr().kind).toBe('validation');
    expect((await run({ task: '   ' }))._unsafeUnwrapErr().kind).toBe('validation');
    expect(store.starts).toEqual([]);
  });

  it('refuses an actor without the guidance permission', async () => {
    const store = inMemorySessions();
    const { deps } = helpSessionDependencies(store.repository, parent({ roles: [TEACHER_ROLE] }));

    const result = await new StartHelpSession(deps).execute({
      childProfileId: OWN_CHILD,
      task: TASK,
      subject: 'math',
    });

    expect(result._unsafeUnwrapErr().kind).toBe('forbidden');
    expect(store.starts).toEqual([]);
  });
});

describe('GetOpenHelpSession', () => {
  it('answers null when the child has no open session', async () => {
    const { deps } = helpSessionDependencies(inMemorySessions().repository);

    const view = await new GetOpenHelpSession(deps).execute({ childProfileId: OWN_CHILD });

    expect(view._unsafeUnwrap()).toBeNull();
  });

  it('resumes the stored state: hints, checks as results only, and the open question', async () => {
    const stored = storedSession({
      hintLevel: 'next_step',
      hints: [
        {
          requestId: toStepRequestId('h-1'),
          level: 'understand_task',
          kind: 'generated',
          text: 'Was weißt du?',
        },
        {
          requestId: toStepRequestId('h-2'),
          level: 'next_step',
          kind: 'fallback',
          reason: 'timeout',
        },
      ],
      answerChecks: [
        check({ result: 'not_yet', question: null }),
        check({ requestId: toStepRequestId('c-2') }),
      ],
    });
    const { deps } = helpSessionDependencies(inMemorySessions([stored]).repository);

    const view = (
      await new GetOpenHelpSession(deps).execute({ childProfileId: OWN_CHILD })
    )._unsafeUnwrap();

    expect(view).toEqual({
      sessionId: 'session-1',
      task: TASK,
      subject: 'math',
      status: 'awaiting_comprehension_reply',
      hintLevel: 'next_step',
      hints: [
        { kind: 'generated', level: 'understand_task', text: 'Was weißt du?' },
        { kind: 'fallback', level: 'next_step', reason: 'timeout' },
      ],
      answerChecks: [
        { result: 'not_yet', assessedBy: 'ai', hintLevel: 'next_step' },
        { result: 'correct', assessedBy: 'ai', hintLevel: 'next_step' },
      ],
      openQuestion: { kind: 'predefined', feedback: 'comprehension_question', reason: null },
      updatedAt: '2026-10-25T08:00:00.000Z',
    });
    // The child's answers stay in the store.
    expect(JSON.stringify(view)).not.toContain('"42"');
  });

  it("refuses another parent's child", async () => {
    const { deps } = helpSessionDependencies(inMemorySessions([storedSession()]).repository);

    const result = await new GetOpenHelpSession(deps).execute({ childProfileId: OTHER_CHILD });

    expect(result._unsafeUnwrapErr().kind).toBe('not_found');
  });
});

describe('ReplyToComprehensionQuestion', () => {
  const reply = (sessions = [storedSession({ answerChecks: [check()] })]) => {
    const store = inMemorySessions(sessions);
    const { deps, events } = helpSessionDependencies(store.repository);
    const rewards: string[] = [];
    const reward = {
      award: (_child: unknown, sessionId: string) => {
        rewards.push(sessionId);
        return Promise.resolve();
      },
    };
    return {
      store,
      events,
      rewards,
      run: (overrides: Partial<Parameters<ReplyToComprehensionQuestion['execute']>[0]> = {}) =>
        new ReplyToComprehensionQuestion({ ...deps, reward }).execute({
          childProfileId: OWN_CHILD,
          sessionId: 'session-1',
          reply: 'Erst die Zehner, dann die Einer.',
          ...overrides,
        }),
    };
  };

  it('marks the task understood only after a correct answer and the reply, and ends the session', async () => {
    const { run, store, events, rewards } = reply();

    const view = (await run())._unsafeUnwrap();

    expect(rewards).toEqual(['session-1']);
    expect(view).toEqual({ sessionId: 'session-1', status: 'understood' });
    expect(store.replies).toEqual([{ completes: true, text: 'Erst die Zehner, dann die Einer.' }]);
    expect(store.sessions.get('session-1')?.status).toBe('completed');
    expect(events).toEqual([
      expect.objectContaining({ type: 'guidance.comprehension_replied', understood: true }),
    ]);
    expect(JSON.stringify(events)).not.toContain('Zehner');
  });

  it('refuses a reply when no question is open', async () => {
    const { run, store } = reply([storedSession({ answerChecks: [check({ question: null })] })]);

    const error = (await run())._unsafeUnwrapErr();

    expect(error).toMatchObject({ kind: 'conflict', code: 'guidance.no_open_question' });
    expect(store.replies).toEqual([]);
  });

  it('refuses a question that was already answered, so the reply is stored once', async () => {
    const { run, store, rewards } = reply();

    await run();
    const again = await run();

    // XP for the session is granted once (#83).
    expect(rewards).toEqual(['session-1']);
    // The session is completed, so it is no longer open to replies.
    expect(again._unsafeUnwrapErr().kind).toBe('not_found');
    expect(store.replies).toHaveLength(1);
  });

  it('checks the reply like any child input', async () => {
    const { run, store } = reply();

    expect((await run({ reply: '   ' }))._unsafeUnwrapErr().kind).toBe('validation');
    expect((await run({ reply: 'a​b' }))._unsafeUnwrapErr().kind).toBe('validation');
    expect((await run({ sessionId: '' }))._unsafeUnwrapErr().kind).toBe('validation');
    expect(store.replies).toEqual([]);
  });

  it("refuses another parent's child and an unknown session", async () => {
    const { run, store } = reply();

    expect((await run({ childProfileId: OTHER_CHILD }))._unsafeUnwrapErr().kind).toBe('not_found');
    expect((await run({ sessionId: 'session-x' }))._unsafeUnwrapErr()).toMatchObject({
      kind: 'not_found',
      code: 'guidance.session_not_found',
    });
    expect(store.replies).toEqual([]);
  });
});

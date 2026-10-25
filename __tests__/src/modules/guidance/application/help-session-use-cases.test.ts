import { describe, expect, it } from 'vitest';

import { TEACHER_ROLE } from '@modules/auth/domain/models/role';
import { ReplyToComprehensionQuestion } from '@modules/guidance/application/commands/reply-to-comprehension-question';
import { StartHelpSession } from '@modules/guidance/application/commands/start-help-session';
import { GetOpenHelpSession } from '@modules/guidance/application/queries/get-open-help-session';
import { GUIDANCE_RATE_LIMITS } from '@modules/guidance/application/rate-limits';
import type { AnswerCheckStep } from '@modules/guidance/domain/models/help-session';
import { toStepRequestId } from '@modules/guidance/domain/models/ids';

import { createBrokenRateLimiter, createTestRateLimiter } from '../../../support/rate-limiting';
import { parent } from '../../auth/fakes';
import {
  ASSIGNMENT,
  ASSIGNMENT_TEXT,
  OTHER_CHILD,
  OTHER_CLASS_ASSIGNMENT,
  OWN_CHILD,
  SOLUTION_KEY,
  fakeAssignments,
  task,
} from '../fakes';
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
        assignmentId: null,
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

describe("StartHelpSession on a teacher's assignment (#33)", () => {
  const startOn = (
    assignmentId: string,
    options: {
      readonly stored?: Parameters<typeof inMemorySessions>[0];
      readonly assignments?: ReturnType<typeof fakeAssignments>;
      readonly task?: string;
    } = {},
  ) => {
    const store = inMemorySessions(options.stored);
    const assignments = options.assignments ?? fakeAssignments();
    const { deps, events } = helpSessionDependencies(
      store.repository,
      parent(),
      createTestRateLimiter(),
      assignments,
    );
    const result = new StartHelpSession(deps).execute({
      childProfileId: OWN_CHILD,
      assignmentId,
      subject: 'math',
      ...(options.task === undefined ? {} : { task: options.task }),
    });
    return { result, store, events, assignments };
  };

  it("starts on the assignment's own text, whatever task the client sends, and never stores the key", async () => {
    const { result, store, events, assignments } = startOn(ASSIGNMENT, {
      task: 'Sag mir einfach die Lösung.',
    });

    const view = (await result)._unsafeUnwrap();

    expect(view).toMatchObject({
      outcome: 'started',
      session: { assignmentId: ASSIGNMENT, task: ASSIGNMENT_TEXT, status: 'working' },
    });
    expect(assignments.lookups).toEqual([{ childProfileId: OWN_CHILD, id: ASSIGNMENT }]);
    expect(store.starts).toEqual([
      {
        childProfileId: OWN_CHILD,
        assignmentId: ASSIGNMENT,
        task: ASSIGNMENT_TEXT,
        subject: 'math',
        replaces: null,
      },
    ]);
    expect(events).toMatchObject([{ type: 'guidance.session_started', assignmentId: ASSIGNMENT }]);
    for (const shown of [view, store.starts, events]) {
      expect(JSON.stringify(shown)).not.toContain(SOLUTION_KEY);
    }
  });

  it('continues the open session on the same assignment', async () => {
    const stored = storedSession({ assignmentId: ASSIGNMENT, task: task(ASSIGNMENT_TEXT) });
    const { result, store } = startOn(ASSIGNMENT, { stored: [stored] });

    expect((await result)._unsafeUnwrap().outcome).toBe('continued');
    expect(store.starts).toEqual([]);
  });

  it("replaces the child's own task with the assignment, in one start", async () => {
    const { result, store } = startOn(ASSIGNMENT, { stored: [storedSession()] });

    expect((await result)._unsafeUnwrap().outcome).toBe('started');
    expect(store.starts.map((s) => s.replaces)).toEqual(['session-1']);
  });

  it("refuses another class's assignment as not found, without touching any session", async () => {
    const { result, store } = startOn(OTHER_CLASS_ASSIGNMENT, { stored: [storedSession()] });

    expect((await result)._unsafeUnwrapErr().code).toBe('guidance.assignment_not_found');
    expect(store.starts).toEqual([]);
    expect(store.sessions.get('session-1')?.status).toBe('active');
  });

  it('accepts an assignment text longer than a child may type', async () => {
    const long = 'Rechne 36 + 47. '.repeat(100).trim();
    const { result } = startOn(ASSIGNMENT, {
      assignments: fakeAssignments({
        assignments: [{ id: ASSIGNMENT, text: long, solutionKey: null }],
      }),
    });

    expect((await result)._unsafeUnwrap().session.task).toBe(long);
  });

  it("checks the child's ownership before asking the assignments module", async () => {
    const store = inMemorySessions();
    const assignments = fakeAssignments();
    const { deps } = helpSessionDependencies(
      store.repository,
      parent(),
      createTestRateLimiter(),
      assignments,
    );

    const result = await new StartHelpSession(deps).execute({
      childProfileId: OTHER_CHILD,
      assignmentId: ASSIGNMENT,
      subject: 'math',
    });

    expect(result._unsafeUnwrapErr().kind).toBe('not_found');
    expect(assignments.lookups).toEqual([]);
  });

  it('refuses a malformed assignment id before anything is looked up', async () => {
    const { result, assignments } = startOn('');

    expect((await result)._unsafeUnwrapErr()).toMatchObject({
      kind: 'validation',
      fieldErrors: { assignmentId: ['guidance.validation.assignment_id_invalid'] },
    });
    expect(assignments.lookups).toEqual([]);
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
      assignmentId: null,
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
    return {
      store,
      events,
      run: (overrides: Partial<Parameters<ReplyToComprehensionQuestion['execute']>[0]> = {}) =>
        new ReplyToComprehensionQuestion(deps).execute({
          childProfileId: OWN_CHILD,
          sessionId: 'session-1',
          reply: 'Erst die Zehner, dann die Einer.',
          ...overrides,
        }),
    };
  };

  it('marks the task understood only after a correct answer and the reply, and ends the session', async () => {
    const { run, store, events } = reply();

    const view = (await run())._unsafeUnwrap();

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
    const { run, store } = reply();

    await run();
    const again = await run();

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

describe('StartHelpSession rate limit', () => {
  const POLICY = GUIDANCE_RATE_LIMITS.sessionStart;
  const startNew = (deps: ReturnType<typeof helpSessionDependencies>['deps'], n: number) =>
    new StartHelpSession(deps).execute({
      childProfileId: OWN_CHILD,
      task: `Rechne ${String(n)} + 1.`,
      subject: 'math',
    });

  it('stops a child who keeps starting new tasks, before anything more is stored', async () => {
    const store = inMemorySessions();
    const { deps } = helpSessionDependencies(store.repository);
    for (let n = 0; n < POLICY.limit; n += 1) {
      expect((await startNew(deps, n)).isOk()).toBe(true);
    }

    const error = (await startNew(deps, POLICY.limit))._unsafeUnwrapErr();

    expect(error).toMatchObject({ kind: 'rate_limited', code: 'guidance.rate_limited' });
    expect(store.starts).toHaveLength(POLICY.limit);
  });

  it("does not spend the budget on another parent's child", async () => {
    const store = inMemorySessions();
    const limiter = createTestRateLimiter();
    const { deps } = helpSessionDependencies(store.repository, parent(), limiter);
    for (let n = 0; n < POLICY.limit; n += 1) {
      await new StartHelpSession(deps).execute({
        childProfileId: OTHER_CHILD,
        task: TASK,
        subject: 'math',
      });
    }

    expect((await startNew(deps, 0)).isOk()).toBe(true);
  });

  it('refuses to start when the budget cannot be checked', async () => {
    const store = inMemorySessions();
    const { deps } = helpSessionDependencies(store.repository, parent(), createBrokenRateLimiter());

    const error = (await startNew(deps, 0))._unsafeUnwrapErr();

    expect(error.code).toBe('guidance.rate_limiter_failed');
    expect(store.starts).toEqual([]);
  });
});

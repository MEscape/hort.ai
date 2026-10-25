import { describe, expect, it } from 'vitest';

import { TEACHER_ROLE } from '@modules/auth/domain/models/role';
import { ReplyToComprehensionQuestion } from '@modules/guidance/application/commands/reply-to-comprehension-question';
import { StartHelpSession } from '@modules/guidance/application/commands/start-help-session';
import { GetOpenHelpSession } from '@modules/guidance/application/queries/get-open-help-session';
import { GUIDANCE_RATE_LIMITS } from '@modules/guidance/application/rate-limits';
import type { AnswerCheckStep } from '@modules/guidance/domain/models/help-session';
import { toStepRequestId } from '@modules/guidance/domain/models/ids';
import type { TopicClassifier } from '@modules/guidance/domain/ports/topic-classifier.port';
import { UNCLASSIFIED_TOPIC } from '@modules/guidance/domain/topic/session-topic';

import { okAsync } from '@lib/result';

import { createBrokenRateLimiter, createTestRateLimiter } from '../../../support/rate-limiting';
import { parent } from '../../auth/fakes';
import {
  ASSIGNMENT,
  ASSIGNMENT_TEXT,
  OTHER_CHILD,
  OTHER_CLASS_ASSIGNMENT,
  OWN_CHILD,
  REQUEST,
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
      // Without a classifier the task opens as homework, as before #92.
      {
        type: 'guidance.topic_classification_fallback_used',
        reason: 'provider_unavailable',
        codes: [],
      },
      {
        type: 'guidance.session_started',
        tenantId: parent().tenantId,
        actorId: parent().id,
        childProfileId: OWN_CHILD,
        sessionId: view.session.sessionId,
        assignmentId: null,
        subject: 'math',
        replaced: null,
        opening: null,
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

describe('StartHelpSession topic classification (#92)', () => {
  const CODE = REQUEST.competencies[0]?.code ?? '';

  /** A classifier that answers with `intent` at `confidence`, and the competency for homework. */
  function classifier(intent: string, confidence: number) {
    const tasks: string[] = [];
    const fake: TopicClassifier = {
      name: 'jev',
      classify: (request) => {
        tasks.push(request.task);
        return okAsync({
          version: 1,
          intent: { value: intent, confidence },
          subject: null,
          topic:
            intent === 'homework'
              ? { kind: 'competency', competencyCode: CODE, confidence }
              : { kind: 'none' },
        });
      },
    };
    return { fake, tasks };
  }

  function startWith(fake: TopicClassifier, initial = inMemorySessions()) {
    const { deps } = helpSessionDependencies(
      initial.repository,
      parent(),
      createTestRateLimiter(),
      fakeAssignments(),
      fake,
    );
    return (taskText: string) =>
      new StartHelpSession(deps).execute({
        childProfileId: OWN_CHILD,
        task: taskText,
        subject: 'math',
      });
  }

  it('stores a sure competency and opens as usual', async () => {
    const store = inMemorySessions();
    const view = (await startWith(classifier('homework', 0.9).fake, store)(TASK))._unsafeUnwrap();

    expect(view.session.opening).toBeNull();
    expect(store.starts[0]?.topic).toEqual({
      intent: 'homework',
      opening: null,
      competencyCode: CODE,
      openTopicLabel: null,
      classifiedBy: 'jev',
    });
  });

  it('answers small talk with the redirect opening', async () => {
    const view = (
      await startWith(classifier('small_talk', 0.9).fake)('Hallo Max, wie geht es dir?')
    )._unsafeUnwrap();

    expect(view.session.opening).toEqual({ kind: 'redirect', intent: 'small_talk' });
  });

  it('asks to clarify once; the reply that replaces that session is never asked about again', async () => {
    const asked = storedSession({
      task: task('Hilfe'),
      topic: {
        ...UNCLASSIFIED_TOPIC,
        intent: 'homework',
        opening: { kind: 'clarify' },
        classifiedBy: 'jev',
      },
    });
    const unsure = classifier('homework', 0.3).fake;

    expect((await startWith(unsure)('Hilfe'))._unsafeUnwrap().session.opening).toEqual({
      kind: 'clarify',
    });
    const reply = await startWith(
      unsure,
      inMemorySessions([asked]),
    )('Hilfe. Ich soll 23 + 19 rechnen.');
    expect(reply._unsafeUnwrap().session.opening).toBeNull();
  });

  it('does not classify again when the same task continues', async () => {
    const { fake, tasks } = classifier('homework', 0.9);

    await startWith(fake, inMemorySessions([storedSession()]))(TASK);

    expect(tasks).toEqual([]);
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
        topic: { ...UNCLASSIFIED_TOPIC, classifiedBy: 'fallback' },
      },
    ]);
    expect(events).toMatchObject([
      { type: 'guidance.topic_classification_fallback_used' },
      { type: 'guidance.session_started', assignmentId: ASSIGNMENT },
    ]);
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
      opening: null,
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
    expect(again._unsafeUnwrap()).toEqual({ sessionId: 'session-1', status: 'understood' });
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

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Actor } from '@modules/auth/domain/models/actor';
import { TEACHER_ROLE } from '@modules/auth/domain/models/role';
import { CheckAnswer } from '@modules/guidance/application/commands/check-answer';
import { ReplyToComprehensionQuestion } from '@modules/guidance/application/commands/reply-to-comprehension-question';
import { RequestHint } from '@modules/guidance/application/commands/request-hint';
import { StartHelpSession } from '@modules/guidance/application/commands/start-help-session';
import { GetOpenHelpSession } from '@modules/guidance/application/queries/get-open-help-session';
import { AnswerCoach } from '@modules/guidance/application/services/answer-coach';
import { HintOrchestrator } from '@modules/guidance/application/services/hint-orchestrator';
import { checkAnswerAction } from '@modules/guidance/presentation/actions/check-answer-action';
import { getOpenHelpSessionAction } from '@modules/guidance/presentation/actions/get-open-help-session-action';
import { replyComprehensionAction } from '@modules/guidance/presentation/actions/reply-comprehension-action';
import { requestHintAction } from '@modules/guidance/presentation/actions/request-hint-action';
import { startHelpSessionAction } from '@modules/guidance/presentation/actions/start-help-session-action';

import { parent } from '../../auth/fakes';
import {
  ASSIGNMENT,
  ASSIGNMENT_TEXT,
  OTHER_CHILD,
  OTHER_CLASS_ASSIGNMENT,
  OWN_CHILD,
  SOLUTION_KEY,
  fakeCompetencies,
  fakeFeedbackProvider,
  fakeHintProvider,
} from '../fakes';
import { helpSessionDependencies, inMemorySessions } from '../help-session-fakes';

import type { FeedbackScripts } from '../fakes';

/** The use cases behind the actions, rebuilt per test over an in-memory store and a fake AI. */
const wiring = vi.hoisted(() => ({
  commands: {},
  guidance: {},
  queries: {},
}));
vi.mock('@modules/guidance/composition', () => ({
  getHelpSessionCommands: () => wiring.commands,
  getHelpSessionQueries: () => wiring.queries,
  getGuidanceCommands: () => wiring.guidance,
}));

const TASK = 'Rechne 23 + 19.';
const SOLUTION = '42';
const PRAISE = 'Super, wie du die Zehner zuerst zusammengezählt hast!';
const QUESTION = 'Wie bist du auf deine Antwort gekommen?';

/** The fake AI tries to give the result away in every hint; the guard must replace it. */
const LEAKING_HINT = {
  answer: { version: 1, kind: 'hint', text: `Das Ergebnis ist ${SOLUTION}.` },
};

const feedback = (kind: string, text: string, extra: object = {}) => ({
  answer: { version: 1, kind, hintLevel: 'understand_task', text, ...extra },
});

const CORRECT: FeedbackScripts = {
  answer_assessment: feedback('answer_assessment', 'Das stimmt!', { result: 'correct' }),
  praise: feedback('praise', PRAISE),
  comprehension_question: feedback('comprehension_question', QUESTION),
};

function wire(actor: Actor = parent()) {
  const store = inMemorySessions();
  const { deps, events } = helpSessionDependencies(store.repository, actor);
  const hintProvider = fakeHintProvider(LEAKING_HINT);
  const { provider: feedbackProvider } = fakeFeedbackProvider(CORRECT);
  const stepDeps = { ...deps, competencies: fakeCompetencies().retrieval };
  wiring.commands = {
    startHelpSession: new StartHelpSession(deps),
    replyToComprehensionQuestion: new ReplyToComprehensionQuestion(deps),
  };
  wiring.queries = { getOpenHelpSession: new GetOpenHelpSession(deps) };
  wiring.guidance = {
    requestHint: new RequestHint({
      ...stepDeps,
      hints: new HintOrchestrator({ provider: hintProvider.provider, audit: deps.audit }),
    }),
    checkAnswer: new CheckAnswer({
      ...stepDeps,
      answers: new AnswerCoach({ provider: feedbackProvider, audit: deps.audit }),
    }),
  };
  return { store, events, hintRequests: hintProvider.requests };
}

const start = () =>
  startHelpSessionAction({ childProfileId: OWN_CHILD, task: TASK, subject: 'math' });

describe('help session Server Actions', () => {
  beforeEach(() => {
    wire();
  });

  it('walks a whole session and no response carries the solution or the child’s texts', async () => {
    const started = await start();
    expect(started).toMatchObject({ ok: true, data: { outcome: 'started' } });
    const sessionId = started.ok ? started.data.session.sessionId : '';
    const step = { childProfileId: OWN_CHILD, sessionId };

    const hint = await requestHintAction({ ...step, requestId: 'hint-1' });
    const checked = await checkAnswerAction({ ...step, requestId: 'check-1', answer: SOLUTION });
    const resumed = await getOpenHelpSessionAction({ childProfileId: OWN_CHILD });
    const replied = await replyComprehensionAction({ ...step, reply: 'Erst 20 + 10, dann 3 + 9.' });
    const afterwards = await getOpenHelpSessionAction({ childProfileId: OWN_CHILD });

    expect(hint).toMatchObject({ ok: true, data: { hint: { kind: 'fallback' } } });
    expect(checked).toMatchObject({ ok: true, data: { result: 'correct' } });
    expect(resumed).toMatchObject({
      ok: true,
      data: { sessionId, status: 'awaiting_comprehension_reply', hintLevel: 'understand_task' },
    });
    expect(replied).toEqual({ ok: true, data: { sessionId, status: 'understood' } });
    expect(afterwards).toEqual({ ok: true, data: null });
    for (const response of [started, hint, checked, resumed, replied, afterwards]) {
      expect(JSON.stringify(response)).not.toContain(SOLUTION);
      expect(JSON.stringify(response)).not.toContain('Erst 20');
    }
  });

  it('continues the open session when the same task is started again', async () => {
    const first = await start();
    const again = await start();

    expect(again).toMatchObject({ ok: true, data: { outcome: 'continued' } });
    expect(first.ok && again.ok && again.data.session.sessionId).toBe(
      first.ok && first.data.session.sessionId,
    );
  });

  it('decides "understood" itself: a status from the client is dropped', async () => {
    const started = await start();
    const sessionId = started.ok ? started.data.session.sessionId : '';

    const replied = await replyComprehensionAction({
      childProfileId: OWN_CHILD,
      sessionId,
      reply: 'Ich habe es verstanden.',
      status: 'understood',
    });

    expect(replied).toMatchObject({ ok: false, error: { code: 'guidance.no_open_question' } });
  });

  it('refuses malformed input with stable field codes before any use case runs', async () => {
    const { store } = wire();

    const results = await Promise.all([
      startHelpSessionAction({ childProfileId: '', task: TASK, subject: 'math' }),
      startHelpSessionAction({ childProfileId: OWN_CHILD, task: TASK, subject: 'x'.repeat(33) }),
      startHelpSessionAction({
        childProfileId: OWN_CHILD,
        task: 'a'.repeat(2001),
        subject: 'math',
      }),
      getOpenHelpSessionAction({}),
      replyComprehensionAction({ childProfileId: OWN_CHILD, sessionId: '', reply: 'ok' }),
    ]);

    expect(results.map((result) => !result.ok && result.error.fieldErrors)).toEqual([
      { childProfileId: ['guidance.validation.child_profile_id_invalid'] },
      { subject: ['guidance.validation.subject_invalid'] },
      { task: ['guidance.child_input.too_long'] },
      { childProfileId: ['guidance.validation.child_profile_id_invalid'] },
      { sessionId: ['guidance.validation.session_id_invalid'] },
    ]);
    expect(store.starts).toEqual([]);
  });

  it('answers an unknown subject or an empty task as invalid, without storing a session', async () => {
    const { store } = wire();

    const results = await Promise.all([
      startHelpSessionAction({ childProfileId: OWN_CHILD, task: TASK, subject: 'magic' }),
      startHelpSessionAction({ childProfileId: OWN_CHILD, task: '   ', subject: 'math' }),
    ]);

    expect(results.every((result) => !result.ok)).toBe(true);
    expect(store.starts).toEqual([]);
  });

  it("treats another parent's child like an unknown one", async () => {
    const results = await Promise.all([
      startHelpSessionAction({ childProfileId: OTHER_CHILD, task: TASK, subject: 'math' }),
      getOpenHelpSessionAction({ childProfileId: OTHER_CHILD }),
      replyComprehensionAction({ childProfileId: OTHER_CHILD, sessionId: 's', reply: 'ok' }),
    ]);

    expect(results.map((result) => !result.ok && result.error.code)).toEqual([
      'child_profile.not_found',
      'child_profile.not_found',
      'child_profile.not_found',
    ]);
  });

  it('refuses a signed-in user without the guidance permission', async () => {
    wire(parent({ roles: [TEACHER_ROLE] }));

    const results = await Promise.all([
      start(),
      getOpenHelpSessionAction({ childProfileId: OWN_CHILD }),
      replyComprehensionAction({ childProfileId: OWN_CHILD, sessionId: 's', reply: 'ok' }),
    ]);

    expect(results.map((result) => !result.ok && result.error.code)).toEqual([
      'auth.permission_denied',
      'auth.permission_denied',
      'auth.permission_denied',
    ]);
  });
});

describe("help session Server Actions on a teacher's assignment (#33)", () => {
  beforeEach(() => {
    wire();
  });

  it("starts on the assignment, checks the answer against the teacher's key, and never returns it", async () => {
    const started = await startHelpSessionAction({
      childProfileId: OWN_CHILD,
      assignmentId: ASSIGNMENT,
      subject: 'math',
    });
    expect(started).toMatchObject({
      ok: true,
      data: { outcome: 'started', session: { assignmentId: ASSIGNMENT, task: ASSIGNMENT_TEXT } },
    });
    const sessionId = started.ok ? started.data.session.sessionId : '';
    const step = { childProfileId: OWN_CHILD, sessionId };

    const checked = await checkAnswerAction({
      ...step,
      requestId: 'check-1',
      answer: SOLUTION_KEY,
    });
    const wrong = await checkAnswerAction({ ...step, requestId: 'check-2', answer: '73' });

    expect(checked).toMatchObject({
      ok: true,
      data: { result: 'correct', assessedBy: 'solution_key' },
    });
    expect(wrong).toMatchObject({
      ok: true,
      data: { result: 'not_yet', assessedBy: 'solution_key' },
    });
    for (const response of [started, wrong]) {
      expect(JSON.stringify(response)).not.toContain(SOLUTION_KEY);
    }
  });

  it("refuses another class's assignment with its own code", async () => {
    const started = await startHelpSessionAction({
      childProfileId: OWN_CHILD,
      assignmentId: OTHER_CLASS_ASSIGNMENT,
      subject: 'math',
    });

    expect(started).toMatchObject({ ok: false, error: { code: 'guidance.assignment_not_found' } });
  });
});

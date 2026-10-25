import { describe, expect, it } from 'vitest';

import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import type { CurrentActorProvider } from '@modules/auth/domain/ports/current-actor-provider.port';
import { CheckAnswer } from '@modules/guidance/application/commands/check-answer';
import { GUIDANCE_RATE_LIMITS } from '@modules/guidance/application/rate-limits';
import { AnswerCoach } from '@modules/guidance/application/services/answer-coach';
import { parseStepRequestId } from '@modules/guidance/domain/models/ids';

import type { RateLimiter } from '@lib/rate-limit';

import { createBrokenRateLimiter, createTestRateLimiter } from '../../../support/rate-limiting';
import { parent, recordingAudit as recordingSecurityAudit, signedInAs } from '../../auth/fakes';
import {
  OTHER_CHILD,
  OWN_CHILD,
  REQUEST,
  SESSION,
  fakeCompetencies,
  fakeFeedbackProvider,
  fakeSessionStore,
  openSession,
  ownChildren,
  recordingAuditLog,
} from '../fakes';

import type { FeedbackScripts } from '../fakes';

const LEVEL = 'next_step' as const;
const TASK = 'Lisa hat 3 Äpfel und bekommt 4 dazu. Wie viele Äpfel hat sie?';
const ANSWER = 'Sie hat sieben Birnen.';
const PRAISE = 'Super, wie du die beiden Zahlen zusammengezählt hast!';
const QUESTION = 'Warum hast du hier plus gerechnet?';
const NOT_YET = 'Noch nicht ganz. Schau dir an, wie viele Äpfel dazukommen.';

/** A session whose highest hint so far is "point to the next step", so the feedback is worded at that rung. */
const onNextStep = (overrides: Parameters<typeof openSession>[0] = {}) =>
  openSession({
    hints: [
      {
        requestId: parseStepRequestId('hint-1')._unsafeUnwrap(),
        level: LEVEL,
        kind: 'fallback',
        reason: 'timeout',
      },
    ],
    ...overrides,
  });

const output = (kind: string, text: string, extra: object = {}) => ({
  answer: { version: 1, kind, hintLevel: LEVEL, text, ...extra },
});

const CORRECT: FeedbackScripts = {
  answer_assessment: output('answer_assessment', 'Das stimmt!', { result: 'correct' }),
  praise: output('praise', PRAISE),
  comprehension_question: output('comprehension_question', QUESTION),
};

interface BuildOptions {
  readonly currentActor?: CurrentActorProvider;
  readonly rateLimiter?: RateLimiter;
  readonly scripts?: FeedbackScripts;
  readonly curriculumFails?: true;
  readonly owned?: Parameters<typeof ownChildren>[0];
  readonly sessions?: ReturnType<typeof fakeSessionStore>;
}

function build(options: BuildOptions = {}) {
  const { provider, requests } = fakeFeedbackProvider(options.scripts ?? CORRECT);
  const { audit, events } = recordingAuditLog();
  const { retrieval, queries } = fakeCompetencies({ fails: options.curriculumFails === true });
  const sessions = options.sessions ?? fakeSessionStore([onNextStep()]);
  const checkAnswer = new CheckAnswer({
    authorization: createAuthorizationService({
      currentActor: options.currentActor ?? signedInAs(parent()),
      audit: recordingSecurityAudit(),
    }),
    childProfiles: ownChildren(options.owned),
    competencies: retrieval,
    rateLimiter: options.rateLimiter ?? createTestRateLimiter(),
    sessions: sessions.store,
    answers: new AnswerCoach({ provider, audit }),
    audit,
  });
  return { checkAnswer, requests, events, queries, sessions };
}

let requestCounter = 0;
const input = (overrides: Partial<Parameters<CheckAnswer['execute']>[0]> = {}) => {
  requestCounter += 1;
  return {
    childProfileId: OWN_CHILD,
    sessionId: SESSION,
    requestId: `check-${requestCounter}`,
    answer: ANSWER,
    ...overrides,
  };
};

describe('CheckAnswer', () => {
  it('praises a correct answer and asks one comprehension question', async () => {
    const { checkAnswer } = build();

    const result = await checkAnswer.execute(input());

    expect(result.isOk() && result.value).toEqual({
      result: 'correct',
      assessedBy: 'ai',
      next: 'comprehension_question',
      praise: { kind: 'generated', text: PRAISE },
      question: { kind: 'generated', text: QUESTION },
    });
  });

  it('leads an answer that is not right yet back into the hint ladder', async () => {
    const { checkAnswer, requests } = build({
      scripts: { answer_assessment: output('answer_assessment', NOT_YET, { result: 'not_yet' }) },
    });

    const result = await checkAnswer.execute(input({ answer: '8' }));

    expect(result.isOk() && result.value).toEqual({
      result: 'not_yet',
      assessedBy: 'ai',
      next: 'hint_ladder',
      message: { kind: 'generated', text: NOT_YET },
    });
    expect(requests.map((r) => r.kind)).toEqual(['answer_assessment']);
  });

  it("hands the AI the session's task and the checked answer, never the raw input", async () => {
    const { checkAnswer, requests } = build();

    await checkAnswer.execute(input({ answer: `  ${ANSWER}\r\n` }));

    expect(requests.every((r) => r.task === TASK && r.answer === ANSWER)).toBe(true);
  });

  it("words the feedback at the session's current rung, decided by the backend", async () => {
    const { checkAnswer, requests } = build();

    await checkAnswer.execute({ ...input(), level: 'similar_example' } as never);

    expect(requests.every((r) => r.level === LEVEL)).toBe(true);
  });

  it('records the check for the session with the texts the child saw (#78)', async () => {
    const { checkAnswer, sessions } = build();

    await checkAnswer.execute(input({ requestId: 'check-correct' }));

    expect(sessions.checks).toEqual([
      {
        requestId: 'check-correct',
        answer: ANSWER,
        result: 'correct',
        assessedBy: 'ai',
        feedbackText: PRAISE,
        question: { text: QUESTION },
      },
    ]);
  });

  it('records a predefined message as no text and no question', async () => {
    const { checkAnswer, sessions } = build({ scripts: {} });

    await checkAnswer.execute(input({ requestId: 'check-fallback' }));

    expect(sessions.checks).toEqual([
      {
        requestId: 'check-fallback',
        answer: ANSWER,
        result: null,
        assessedBy: null,
        feedbackText: null,
        question: null,
      },
    ]);
  });

  it('still gives the feedback when the session cannot store it, and logs the code', async () => {
    const { checkAnswer, events } = build({
      sessions: fakeSessionStore([onNextStep()], { failsRecording: true }),
    });

    const result = await checkAnswer.execute(input());

    expect(result.isOk() && result.value).toMatchObject({ result: 'correct' });
    expect(events).toContainEqual({
      type: 'guidance.step_not_recorded',
      step: 'answer_check',
      code: 'guidance.session_store_failed',
    });
  });

  it('refuses an unknown session as not found, without asking the AI', async () => {
    const { checkAnswer, requests } = build();

    const result = await checkAnswer.execute(input({ sessionId: 'session-unknown' }));

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'not_found',
      code: 'guidance.session_not_found',
    });
    expect(requests).toEqual([]);
  });

  it('records who checked which child and how it ended, with ids only', async () => {
    const { checkAnswer, events } = build();

    await checkAnswer.execute(input());

    expect(events).toEqual([
      {
        type: 'guidance.answer_checked',
        tenantId: 'default',
        actorId: 'parent-1',
        childProfileId: 'child-1',
        level: LEVEL,
        result: 'correct',
        assessedBy: 'ai',
      },
    ]);
    expect(JSON.stringify(events)).not.toContain('Birnen');
    expect(JSON.stringify(events)).not.toContain('Äpfel');
  });

  it('refuses an actor without the hint permission before anything else happens', async () => {
    const { checkAnswer, requests, queries } = build({
      currentActor: signedInAs(parent({ roles: ['teacher'] })),
    });

    const result = await checkAnswer.execute(input());

    expect(result.isErr() && result.error).toMatchObject({ kind: 'forbidden' });
    expect(requests).toEqual([]);
    expect(queries).toEqual([]);
  });

  it("refuses another parent's child as not found, without asking the AI", async () => {
    const { checkAnswer, requests } = build();

    const result = await checkAnswer.execute(input({ childProfileId: OTHER_CHILD }));

    expect(result.isErr() && result.error).toMatchObject({ kind: 'not_found' });
    expect(requests).toEqual([]);
  });

  it.each([
    ['childProfileId', { childProfileId: '' }, 'guidance.validation.child_profile_id_invalid'],
    ['sessionId', { sessionId: '' }, 'guidance.validation.session_id_invalid'],
    ['requestId', { requestId: 'a b' }, 'guidance.validation.request_id_invalid'],
    ['answer', { answer: '   ' }, 'guidance.child_input.empty'],
    ['answer', { answer: 'a'.repeat(1001) }, 'guidance.child_input.too_long'],
  ])(
    'refuses an invalid %s with its stable code, without asking the AI',
    async (field, overrides, code) => {
      const { checkAnswer, requests } = build();

      const result = await checkAnswer.execute(input(overrides));

      expect(result.isErr() && result.error).toMatchObject({
        kind: 'validation',
        fieldErrors: { [field]: [code] },
      });
      expect(requests).toEqual([]);
    },
  );

  it("grounds the feedback in the curriculum of the child's own state and grade (#28)", async () => {
    const { checkAnswer, requests, queries } = build();

    await checkAnswer.execute(input());

    expect(queries).toEqual([{ federalState: 'BY', grade: 2, subject: 'math', task: TASK }]);
    expect(requests.map((r) => r.competencies)).toEqual([
      REQUEST.competencies,
      REQUEST.competencies,
      REQUEST.competencies,
    ]);
  });

  it('still checks the answer ungrounded when the curriculum is unreachable, and logs why', async () => {
    const { checkAnswer, requests, events } = build({ curriculumFails: true });

    const result = await checkAnswer.execute(input());

    expect(result.isOk() && result.value).toMatchObject({ result: 'correct' });
    expect(requests.every((r) => r.competencies.length === 0)).toBe(true);
    expect(events[0]).toEqual({
      type: 'guidance.grounding_unavailable',
      level: LEVEL,
      code: 'curriculum.infrastructure',
    });
  });

  it('passes on the fallback when the AI cannot assess, as a success for the child', async () => {
    const { checkAnswer, events } = build({ scripts: {} });

    const result = await checkAnswer.execute(input());

    expect(result.isOk() && result.value).toEqual({
      result: null,
      assessedBy: null,
      next: 'hint_ladder',
      message: {
        kind: 'predefined',
        feedback: 'answer_assessment',
        reason: 'provider_unavailable',
      },
    });
    expect(events.at(-1)).toMatchObject({
      type: 'guidance.answer_checked',
      result: null,
      assessedBy: null,
    });
  });
});

describe('CheckAnswer rate limit (#11, #14)', () => {
  const { limit } = GUIDANCE_RATE_LIMITS.answerCheck;

  it('refuses a child once their budget is used up, without asking the AI', async () => {
    const { checkAnswer, requests } = build();
    for (let i = 0; i < limit; i += 1) {
      await checkAnswer.execute(input());
    }
    const asked = requests.length;

    const result = await checkAnswer.execute(input());

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'rate_limited',
      code: 'guidance.rate_limited',
    });
    expect(requests).toHaveLength(asked);
  });

  it('counts each child separately, so one sibling does not use up the other one', async () => {
    const SIBLING = OTHER_CHILD;
    const sessions = fakeSessionStore([onNextStep(), onNextStep({ childProfileId: SIBLING })]);
    const { checkAnswer } = build({ owned: [OWN_CHILD, SIBLING], sessions });
    for (let i = 0; i < limit; i += 1) {
      await checkAnswer.execute(input());
    }

    const result = await checkAnswer.execute(input({ childProfileId: SIBLING }));

    expect(result.isOk()).toBe(true);
  });

  it('does not count invalid input against the budget', async () => {
    const { checkAnswer } = build();
    for (let i = 0; i < limit; i += 1) {
      await checkAnswer.execute(input({ answer: '' }));
    }

    expect((await checkAnswer.execute(input())).isOk()).toBe(true);
  });

  it('denies when the limiter store is down, because every check costs external calls', async () => {
    const { checkAnswer, requests } = build({ rateLimiter: createBrokenRateLimiter() });

    const result = await checkAnswer.execute(input());

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'infrastructure',
      code: 'guidance.rate_limiter_failed',
    });
    expect(requests).toEqual([]);
  });
});

describe('CheckAnswer distress check (#90)', () => {
  it('answers a distress message with the help code, without the AI, the budget or the session', async () => {
    const { checkAnswer, requests, events, sessions } = build();

    const result = await checkAnswer.execute(input({ answer: 'Ich bin in Gefahr, hilf mir.' }));

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'validation',
      code: 'guidance.child_safety.distress_signal',
      fieldErrors: { answer: ['guidance.child_safety.distress_signal'] },
    });
    expect(requests).toEqual([]);
    expect(sessions.checks).toEqual([]);
    expect(events).toEqual([
      { type: 'guidance.child_safety.distress_signal', category: 'acute_danger', field: 'answer' },
    ]);
  });
});

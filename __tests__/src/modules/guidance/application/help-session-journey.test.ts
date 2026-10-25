import { describe, expect, it } from 'vitest';

import { CheckAnswer } from '@modules/guidance/application/commands/check-answer';
import { ReplyToComprehensionQuestion } from '@modules/guidance/application/commands/reply-to-comprehension-question';
import { RequestHint } from '@modules/guidance/application/commands/request-hint';
import { StartHelpSession } from '@modules/guidance/application/commands/start-help-session';
import { GetOpenHelpSession } from '@modules/guidance/application/queries/get-open-help-session';
import { AnswerCoach } from '@modules/guidance/application/services/answer-coach';
import { HintOrchestrator } from '@modules/guidance/application/services/hint-orchestrator';
import type { FeedbackProvider } from '@modules/guidance/domain/ports/feedback-provider.port';
import type { HintProvider } from '@modules/guidance/domain/ports/hint-provider.port';

import { errAsync, okAsync } from '@lib/result';

import { createTestRateLimiter } from '../../../support/rate-limiting';
import { OWN_CHILD, fakeCompetencies } from '../fakes';
import { helpSessionDependencies, inMemorySessions } from '../help-session-fakes';

const TASK = 'Lisa hat 3 Äpfel und bekommt 4 dazu. Wie viele Äpfel hat sie?';

/** A fake AI: a hint per rung, and the assessment of each next answer as scripted. */
function scriptedAi(results: string[]) {
  const hints: HintProvider = {
    suggest: (request) =>
      okAsync({
        version: 1,
        kind: 'hint',
        hintLevel: request.level,
        text: 'Was weißt du schon über Plusaufgaben?',
      }),
  };
  const feedback: FeedbackProvider = {
    word: (request) =>
      okAsync({
        version: 1,
        kind: request.kind,
        hintLevel: request.level,
        text: request.kind === 'praise' ? 'Super gerechnet!' : 'Wie bist du darauf gekommen?',
        ...(request.kind === 'answer_assessment' ? { result: results.shift() } : {}),
      }),
  };
  return { hints, feedback };
}

const switchedOff = {
  hints: { suggest: () => errAsync({ kind: 'unavailable' as const }) } satisfies HintProvider,
  feedback: { word: () => errAsync({ kind: 'unavailable' as const }) } satisfies FeedbackProvider,
};

function app(ai: { hints: HintProvider; feedback: FeedbackProvider }) {
  const store = inMemorySessions();
  const { deps, events } = helpSessionDependencies(store.repository);
  const rewards: string[] = [];
  const steps = {
    ...deps,
    competencies: fakeCompetencies().retrieval,
    rateLimiter: createTestRateLimiter(),
  };
  return {
    store,
    events,
    rewards,
    start: new StartHelpSession(deps),
    open: new GetOpenHelpSession(deps),
    hint: new RequestHint({
      ...steps,
      hints: new HintOrchestrator({ provider: ai.hints, audit: deps.audit }),
    }),
    check: new CheckAnswer({
      ...steps,
      answers: new AnswerCoach({ provider: ai.feedback, audit: deps.audit }),
    }),
    reply: new ReplyToComprehensionQuestion({
      ...deps,
      reward: {
        award: (_child, sessionId) => {
          rewards.push(sessionId);
          return Promise.resolve();
        },
      },
    }),
  };
}

describe('the help session journey (#83)', () => {
  it('runs task, hints, a wrong answer, the right answer, the reply and understood', async () => {
    const run = app(scriptedAi(['not_yet', 'correct']));
    const started = (
      await run.start.execute({ childProfileId: OWN_CHILD, task: TASK, subject: 'math' })
    )._unsafeUnwrap();
    const sessionId = started.session.sessionId;
    const step = { childProfileId: OWN_CHILD, sessionId };

    // The thinking prompt, then two hints the child asked for; the backend picks every rung (#30).
    const levels: string[] = [];
    for (const requestId of ['opening', 'tip-1', 'tip-2']) {
      const hint = (await run.hint.execute({ ...step, requestId }))._unsafeUnwrap();
      levels.push(hint.hint.level);
    }
    expect(levels).toEqual(['understand_task', 'activate_prior_knowledge', 'next_step']);

    // A double tap on "hint" stores nothing twice.
    await run.hint.execute({ ...step, requestId: 'tip-2' });
    const wrong = (
      await run.check.execute({ ...step, requestId: 'answer-1', answer: '6' })
    )._unsafeUnwrap();
    expect(wrong).toMatchObject({ result: 'not_yet', next: 'hint_ladder' });

    const right = (
      await run.check.execute({ ...step, requestId: 'answer-2', answer: '7 Äpfel' })
    )._unsafeUnwrap();
    expect(right).toMatchObject({
      result: 'correct',
      praise: { kind: 'generated', text: 'Super gerechnet!' },
    });

    // "Continue" after a reload: the stored session waits for the reply.
    const resumed = (await run.open.execute({ childProfileId: OWN_CHILD }))._unsafeUnwrap();
    expect(resumed).toMatchObject({
      sessionId,
      status: 'awaiting_comprehension_reply',
      openQuestion: { kind: 'generated' },
    });
    expect(resumed?.hints).toHaveLength(3);
    expect(run.rewards).toEqual([]);

    const done = (
      await run.reply.execute({ ...step, reply: 'Weil 4 dazukommen, rechne ich plus.' })
    )._unsafeUnwrap();
    expect(done.status).toBe('understood');
    expect(run.rewards).toEqual([sessionId]);
    expect((await run.open.execute({ childProfileId: OWN_CHILD }))._unsafeUnwrap()).toBeNull();
    expect(run.store.sessions.get(sessionId)?.status).toBe('completed');
    expect(JSON.stringify(run.events)).not.toContain('Äpfel');
  });

  it('runs with the predefined texts while the AI is off', async () => {
    const run = app(switchedOff);
    const started = (
      await run.start.execute({ childProfileId: OWN_CHILD, task: TASK, subject: 'math' })
    )._unsafeUnwrap();
    const step = { childProfileId: OWN_CHILD, sessionId: started.session.sessionId };

    const opening = (await run.hint.execute({ ...step, requestId: 'opening' }))._unsafeUnwrap();
    expect(opening.hint).toMatchObject({ kind: 'fallback', level: 'understand_task' });
    const checked = (
      await run.check.execute({ ...step, requestId: 'answer-1', answer: '7' })
    )._unsafeUnwrap();
    // Nobody could assess it: an encouraging predefined message, back to the hints.
    expect(checked).toMatchObject({ next: 'hint_ladder', message: { kind: 'predefined' } });
  });
});

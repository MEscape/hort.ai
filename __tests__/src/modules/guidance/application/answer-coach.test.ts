import { describe, expect, it } from 'vitest';

import { AnswerCoach } from '@modules/guidance/application/services/answer-coach';

import { REQUEST, fakeFeedbackProvider, recordingAuditLog, task } from '../fakes';

import type { FeedbackScripts } from '../fakes';

const LEVEL = 'next_step' as const;
const PRAISE = 'Super, wie du die beiden Zahlen zusammengezählt hast!';
const QUESTION = 'Warum hast du hier plus gerechnet?';
const NOT_YET = 'Noch nicht ganz. Schau dir an, wie viele Äpfel dazukommen.';

const output = (kind: string, text: string, extra: object = {}) => ({
  answer: { version: 1, kind, hintLevel: LEVEL, text, ...extra },
});

const WORDING: FeedbackScripts = {
  praise: output('praise', PRAISE),
  comprehension_question: output('comprehension_question', QUESTION),
};

function build(scripts: FeedbackScripts = WORDING) {
  const { provider, requests } = fakeFeedbackProvider(scripts);
  const { audit, events } = recordingAuditLog();
  return { coach: new AnswerCoach({ provider, audit }), requests, events };
}

const toCheck = (answer: string, solutionKey: string | null = '7') => ({
  task: REQUEST.task,
  answer: task(answer),
  solutionKey,
  level: LEVEL,
  competencies: REQUEST.competencies,
});

describe('AnswerCoach with a solution key', () => {
  it('praises a correct answer and asks one comprehension question', async () => {
    const { coach } = build();

    expect(await coach.check(toCheck('Sie hat 7 Äpfel.'))).toEqual({
      result: 'correct',
      assessedBy: 'solution_key',
      next: 'comprehension_question',
      praise: { kind: 'generated', text: PRAISE },
      question: { kind: 'generated', text: QUESTION },
    });
  });

  it('leads a wrong answer back into the hint ladder, with the predefined encouragement and no AI call', async () => {
    const { coach, requests } = build();

    expect(await coach.check(toCheck('8'))).toEqual({
      result: 'not_yet',
      assessedBy: 'solution_key',
      next: 'hint_ladder',
      message: { kind: 'predefined', feedback: 'answer_assessment', reason: null },
    });
    expect(requests).toEqual([]);
  });

  it('never hands the AI the solution key', async () => {
    const { coach, requests } = build();

    await coach.check(toCheck('7', 'GEHEIMER-SCHLÜSSEL 7'));

    expect(requests.map((r) => r.kind).sort()).toEqual(['comprehension_question', 'praise']);
    expect(JSON.stringify(requests)).not.toContain('GEHEIMER');
  });
});

describe('AnswerCoach without a solution key', () => {
  it.each([
    ['partly_correct', 'Ein Teil stimmt schon. Schau dir die Einer noch einmal an.'],
    ['not_yet', NOT_YET],
  ])('passes on a validated %s assessment and leads back into the hints', async (result, text) => {
    const { coach } = build({ answer_assessment: output('answer_assessment', text, { result }) });

    expect(await coach.check(toCheck('8', null))).toEqual({
      result,
      assessedBy: 'ai',
      next: 'hint_ladder',
      message: { kind: 'generated', text },
    });
  });

  it('praises and asks after the AI assessed the answer as correct', async () => {
    const { coach } = build({
      ...WORDING,
      answer_assessment: output('answer_assessment', 'Das stimmt!', { result: 'correct' }),
    });

    expect(await coach.check(toCheck('7', null))).toMatchObject({
      result: 'correct',
      assessedBy: 'ai',
      next: 'comprehension_question',
    });
  });

  it.each([
    ['an unknown result', output('answer_assessment', NOT_YET, { result: 'wrong' })],
    ['a missing result', output('answer_assessment', NOT_YET)],
    ['another kind', output('hint', NOT_YET)],
    [
      'an unknown field',
      output('answer_assessment', NOT_YET, { result: 'not_yet', solution: '7' }),
    ],
    ['punishing wording', output('answer_assessment', 'Das ist falsch.', { result: 'not_yet' })],
    ['a timeout', { failure: { kind: 'timeout' as const } }],
  ])('gives no verdict on %s, only encouragement and more help', async (_label, script) => {
    const { coach, events } = build({ answer_assessment: script });

    const feedback = await coach.check(toCheck('8', null));

    expect(feedback).toMatchObject({
      result: null,
      assessedBy: null,
      next: 'hint_ladder',
      message: { kind: 'predefined', feedback: 'answer_assessment' },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'guidance.feedback_fallback_used',
      kind: 'answer_assessment',
    });
  });
});

describe('AnswerCoach wording', () => {
  it('falls back to the predefined praise and question, and logs codes without any text', async () => {
    const { coach, events } = build({
      praise: output('praise', 'Gut gemacht, aber schon wieder so langsam.'),
      comprehension_question: { throws: true },
    });

    const feedback = await coach.check(toCheck('7'));

    expect(feedback).toMatchObject({
      result: 'correct',
      praise: { kind: 'predefined', feedback: 'praise', reason: 'unsafe_output' },
      question: {
        kind: 'predefined',
        feedback: 'comprehension_question',
        reason: 'provider_unavailable',
      },
    });
    expect(events).toEqual(
      expect.arrayContaining([
        {
          type: 'guidance.feedback_fallback_used',
          kind: 'praise',
          level: LEVEL,
          reason: 'unsafe_output',
          codes: ['guidance.child_safety.discouraging'],
        },
        {
          type: 'guidance.feedback_fallback_used',
          kind: 'comprehension_question',
          level: LEVEL,
          reason: 'provider_unavailable',
          codes: [],
        },
      ]),
    );
    expect(JSON.stringify(events)).not.toContain('langsam');
  });

  it('asks the AI only for the kind it needs, at the session’s level', async () => {
    const { coach, requests } = build();

    await coach.check(toCheck('7'));

    expect(requests.every((r) => r.level === LEVEL && r.answer === '7')).toBe(true);
  });
});

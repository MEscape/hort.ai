import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lessonNotFound } from '@modules/lesson/domain/errors/lesson-errors';
import { checkSceneAnswerAction } from '@modules/lesson/presentation/actions/check-scene-answer-action';

import { errAsync, okAsync } from '@lib/result';

const queries = vi.hoisted(() => ({ checkSceneAnswer: { execute: vi.fn() } }));
vi.mock('@modules/lesson/composition', () => ({ getLessonQueries: () => queries }));

const VALID = {
  childProfileId: 'child-1',
  lessonId: 'compare-fractions',
  stepId: 'halfOrQuarter',
  attempt: 1,
  answer: { kind: 'choose', choice: 'top' },
};

const VIEW = {
  outcome: 'correct',
  feedback: { line: 'correct', reaction: 'celebrate', mascot: 'cheer' },
  nextStepId: 'sameParts',
};

describe('checkSceneAnswerAction', () => {
  beforeEach(() => {
    queries.checkSceneAnswer.execute.mockReset();
  });

  it.each([
    undefined,
    {},
    { ...VALID, childProfileId: '' },
    { ...VALID, attempt: 0 },
    { ...VALID, attempt: 1.5 },
    { ...VALID, answer: { kind: 'draw', path: 'M0 0' } },
    { ...VALID, answer: { kind: 'choose', choice: 'left' } },
    { ...VALID, answer: { kind: 'choose', choice: 'top', correct: true } },
    { ...VALID, answer: { kind: 'fill', laid: 9 } },
    { ...VALID, answerKey: 'top' },
    { ...VALID, answer: { kind: 'text', message: '   ' } },
    { ...VALID, answer: { kind: 'text', message: 'x'.repeat(81) } },
  ])('refuses malformed scene event %j before reaching the use case', async (input) => {
    const result = await checkSceneAnswerAction(input);

    expect(result.ok).toBe(false);
    expect(queries.checkSceneAnswer.execute).not.toHaveBeenCalled();
  });

  it('passes a valid event through and returns the judgement as plain values', async () => {
    queries.checkSceneAnswer.execute.mockReturnValue(okAsync(VIEW));

    const result = await checkSceneAnswerAction(VALID);

    expect(queries.checkSceneAnswer.execute).toHaveBeenCalledWith(VALID);
    expect(result).toEqual({ ok: true, data: VIEW });
  });

  it('returns the stable code of a failure, never prose for the child', async () => {
    queries.checkSceneAnswer.execute.mockReturnValue(errAsync(lessonNotFound()));

    const result = await checkSceneAnswerAction(VALID);

    expect(result).toMatchObject({ ok: false, error: { code: 'lesson.not_found' } });
  });
});

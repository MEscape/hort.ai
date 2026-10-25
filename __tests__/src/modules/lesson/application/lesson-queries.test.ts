import { describe, expect, it } from 'vitest';

import { CheckSceneAnswer } from '@modules/lesson/application/queries/check-scene-answer';
import { GetLesson } from '@modules/lesson/application/queries/get-lesson';

import { parent } from '../../auth/fakes';
import { CHILD_ID, build, ownsChildren } from '../fakes';

const LESSON = { childProfileId: CHILD_ID, lessonId: 'compare-fractions' };

function check(stepId: string, answer: unknown, attempt = 1) {
  return new CheckSceneAnswer(build()).execute({
    ...LESSON,
    stepId,
    attempt,
    answer: answer as never,
  });
}

describe('GetLesson', () => {
  it('hands out scenes and narration, never feedback', async () => {
    const view = (await new GetLesson(build()).execute(LESSON))._unsafeUnwrap();

    expect(view.steps.map((step) => step.id)).toEqual([
      'halfOrQuarter',
      'sameParts',
      'buildThreeQuarters',
      'moreParts',
      'twoQuartersHalf',
    ]);
    expect(view.schemaVersion).toBe(1);
    expect(JSON.stringify(view)).not.toMatch(/feedback|correct|hint/);
  });

  it('answers another parent’s child exactly like an unknown lesson', async () => {
    const foreign = await new GetLesson(build({ children: ownsChildren('other') })).execute(LESSON);
    const unknown = await new GetLesson(build()).execute({ ...LESSON, lessonId: 'nope' });

    expect(foreign._unsafeUnwrapErr().code).toBe('lesson.not_found');
    expect(unknown._unsafeUnwrapErr().code).toBe('lesson.not_found');
  });

  it('needs the permission before it looks at any id', async () => {
    const result = await new GetLesson(build({ actor: parent({ roles: [] }) })).execute(LESSON);

    expect(result._unsafeUnwrapErr().kind).toBe('forbidden');
  });
});

describe('CheckSceneAnswer', () => {
  it('celebrates a correct answer and moves to the next step', async () => {
    const view = (await check('halfOrQuarter', { kind: 'choose', choice: 'top' }))._unsafeUnwrap();

    expect(view).toEqual({
      outcome: 'correct',
      feedback: { line: 'correct', reaction: 'celebrate', mascot: 'cheer' },
      nextStepId: 'sameParts',
    });
  });

  it('stays on the step after a miss and offers the hint from the second miss', async () => {
    const first = (await check('moreParts', { kind: 'choose', choice: 'bottom' }))._unsafeUnwrap();
    const second = (
      await check('moreParts', { kind: 'choose', choice: 'bottom' }, 2)
    )._unsafeUnwrap();

    expect(first).toMatchObject({ outcome: 'not_yet', nextStepId: 'moreParts' });
    expect(first.feedback?.reaction).toBe('wobble');
    expect(second.feedback).toEqual({ line: 'hint', reaction: 'line-up', mascot: 'curious' });
  });

  it('ends the lesson after the last step', async () => {
    const view = (
      await check('twoQuartersHalf', { kind: 'choose', choice: 'same' })
    )._unsafeUnwrap();

    expect(view.nextStepId).toBeNull();
  });

  it('rejects an answer the step does not ask for', async () => {
    const result = await check('buildThreeQuarters', { kind: 'choose', choice: 'top' });

    expect(result._unsafeUnwrapErr().code).toBe('lesson.validation_failed');
  });

  it('judges typed text exactly like a tap once it reads as one answer', async () => {
    const view = (
      await check('halfOrQuarter', { kind: 'text', message: 'die obere' })
    )._unsafeUnwrap();

    expect(view).toMatchObject({ outcome: 'correct', nextStepId: 'sameParts' });
  });

  it('asks again for text that reads as no single answer, without judging it', async () => {
    const view = (
      await check('halfOrQuarter', { kind: 'text', message: 'oben oder unten?' }, 3)
    )._unsafeUnwrap();

    expect(view).toEqual({ outcome: 'unclear', feedback: null, nextStepId: 'halfOrQuarter' });
  });

  it('answers a count the bridge does not have as unclear, not as an invalid request', async () => {
    const view = (
      await check('buildThreeQuarters', { kind: 'text', message: '9' })
    )._unsafeUnwrap();

    expect(view.outcome).toBe('unclear');
  });

  it('stops at distress in typed text before reading it at all (#90)', async () => {
    const result = await check('halfOrQuarter', {
      kind: 'text',
      message: 'oben, mein bruder schlägt mich',
    });

    expect(result._unsafeUnwrapErr().code).toBe('lesson.child_distress');
  });

  it('does not judge a step of another lesson or an unknown step', async () => {
    const result = await check('nope', { kind: 'choose', choice: 'top' });

    expect(result._unsafeUnwrapErr().code).toBe('lesson.not_found');
  });
});

import { describe, expect, it } from 'vitest';

import { CheckTaskSceneAnswer } from '@modules/lesson/application/queries/check-task-scene-answer';
import { GetTaskScene } from '@modules/lesson/application/queries/get-task-scene';

import { parent } from '../../auth/fakes';
import { CHILD_ID, build, openTask, ownsChildren } from '../fakes';

const OPEN = { sessionId: 's1', task: 'Rechne 7 + 5' };

function check(answer: unknown, { attempt = 1, sessionId = 's1', task = OPEN.task } = {}) {
  return new CheckTaskSceneAnswer(build({ tasks: openTask({ sessionId: 's1', task }) })).execute({
    childProfileId: CHILD_ID,
    sessionId,
    attempt,
    answer: answer as never,
  });
}

describe('GetTaskScene', () => {
  it('plans a similar example for the open task, never the task itself', async () => {
    const view = (
      await new GetTaskScene(build({ tasks: openTask(OPEN) })).execute({ childProfileId: CHILD_ID })
    )._unsafeUnwrap();

    expect(view).toEqual({
      sessionId: 's1',
      kind: 'number-line',
      scene: { template: 'number-line', sceneVersion: 1, start: 8, jump: 5 },
    });
  });

  it('draws nothing without an open task or without math a template can draw', async () => {
    const none = await new GetTaskScene(build()).execute({ childProfileId: CHILD_ID });
    const words = await new GetTaskScene(
      build({ tasks: openTask({ sessionId: 's1', task: 'Schreibe einen Satz.' }) }),
    ).execute({ childProfileId: CHILD_ID });

    expect(none._unsafeUnwrap()).toBeNull();
    expect(words._unsafeUnwrap()).toBeNull();
  });

  it('needs the permission and the parent’s own child', async () => {
    const foreign = await new GetTaskScene(
      build({ children: ownsChildren('other'), tasks: openTask(OPEN) }),
    ).execute({ childProfileId: CHILD_ID });
    const noRole = await new GetTaskScene(
      build({ actor: parent({ roles: [] }), tasks: openTask(OPEN) }),
    ).execute({ childProfileId: CHILD_ID });

    expect(foreign._unsafeUnwrapErr().code).toBe('lesson.not_found');
    expect(noRole._unsafeUnwrapErr().kind).toBe('forbidden');
  });
});

describe('CheckTaskSceneAnswer', () => {
  it('judges the example on the backend: 8 + 5 lands on 13', async () => {
    const right = (await check({ kind: 'number', value: 13 }))._unsafeUnwrap();
    const wrong = (await check({ kind: 'number', value: 12 }))._unsafeUnwrap();

    expect(right).toEqual({
      outcome: 'correct',
      feedback: { line: 'correct', reaction: 'celebrate', mascot: 'cheer' },
      nextStepId: null,
    });
    expect(wrong.outcome).toBe('not_yet');
  });

  it('shows the steps from the second miss on', async () => {
    const view = (await check({ kind: 'number', value: 12 }, { attempt: 2 }))._unsafeUnwrap();

    expect(view.feedback).toEqual({ line: 'hint', reaction: 'count-steps', mascot: 'curious' });
  });

  it('reads typed numbers and stops at distress first', async () => {
    const typed = (await check({ kind: 'text', message: 'dreizehn' }))._unsafeUnwrap();
    const digits = (await check({ kind: 'text', message: '13' }))._unsafeUnwrap();
    const distress = await check({ kind: 'text', message: 'mein onkel haut mich' });

    expect(typed.outcome).toBe('unclear');
    expect(digits.outcome).toBe('correct');
    expect(distress._unsafeUnwrapErr().code).toBe('lesson.child_distress');
  });

  it('refuses an answer for a session that is no longer the open one', async () => {
    const result = await check({ kind: 'number', value: 13 }, { sessionId: 'old' });

    expect(result._unsafeUnwrapErr().code).toBe('lesson.not_found');
  });

  it('shares out fairly for divided-by: 15 : 3 is planned as 3 plates of 6', async () => {
    const view = (await check({ kind: 'number', value: 6 }, { task: '15 : 3' }))._unsafeUnwrap();

    expect(view.outcome).toBe('correct');
  });
});

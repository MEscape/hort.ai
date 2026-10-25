import 'server-only';

import { getAccessControl } from '@modules/auth';

import { once } from '@lib/utils';

import { CheckSceneAnswer } from './application/queries/check-scene-answer';
import { CheckTaskSceneAnswer } from './application/queries/check-task-scene-answer';
import { GetLesson } from './application/queries/get-lesson';
import { GetTaskScene } from './application/queries/get-task-scene';
import { createLearnerChildAccess } from './infrastructure/children/learner-child-access';
import { createGuidanceOpenTask } from './infrastructure/guidance/guidance-open-task';
import { guidanceChildSafety } from './infrastructure/safety/guidance-child-safety';

import type { LessonDependencies } from './application/lesson-dependencies';

/**
 * The module's composition root: the only place the auth and learner modules are wired in.
 * Built lazily, so importing it during `next build` needs no configuration.
 */
const getDependencies = once((): LessonDependencies => ({
  authorization: getAccessControl(),
  children: createLearnerChildAccess(),
  safety: guidanceChildSafety,
  tasks: createGuidanceOpenTask(),
}));

export const getLessonQueries = once(() => {
  const dependencies = getDependencies();
  return {
    getLesson: new GetLesson(dependencies),
    checkSceneAnswer: new CheckSceneAnswer(dependencies),
    getTaskScene: new GetTaskScene(dependencies),
    checkTaskSceneAnswer: new CheckTaskSceneAnswer(dependencies),
  };
});

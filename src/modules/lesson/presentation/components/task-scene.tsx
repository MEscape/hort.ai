'use client';

import { useTranslations } from '@i18n/client';

import { checkTaskSceneAnswerAction } from '../actions/check-task-scene-answer-action';

import { SceneCard } from './scene-card';

import type { TaskSceneDto } from '../dto/lesson-dto';

export interface TaskSceneProps {
  readonly childProfileId: string;
  readonly view: TaskSceneDto;
}

/**
 * The canvas for a homework task: the same kind of problem with other numbers, to try out before
 * the child works on their own task. The backend plans it from the open task and judges it again
 * from there; it never shows the task itself.
 */
export function TaskScene({ childProfileId, view }: TaskSceneProps) {
  const t = useTranslations('lesson');
  return (
    <SceneCard
      kind={view.kind}
      scene={view.scene}
      label={t('task.example')}
      check={(attempt, answer) =>
        checkTaskSceneAnswerAction({ childProfileId, sessionId: view.sessionId, attempt, answer })
      }
    />
  );
}

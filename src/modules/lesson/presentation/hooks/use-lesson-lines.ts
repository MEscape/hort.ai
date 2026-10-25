'use client';

import { useTranslations } from '@i18n/client';

import { lessonLineKey } from '../messages/message-keys';

import type { StepFeedback } from '../../application/contracts/lesson-constraints';
import type { LessonDto, LessonStepDto } from '../dto/lesson-dto';

/** Every sentence a lesson can say, in the child's language: the same text for stage and side panel. */
export interface LessonLines {
  readonly title: () => string;
  readonly narration: (step: LessonStepDto) => string;
  readonly feedback: (step: LessonStepDto, feedback: StepFeedback) => string;
  readonly unclear: (step: LessonStepDto) => string;
  readonly conclusion: () => string;
}

export function useLessonLines(lesson: LessonDto): LessonLines {
  const t = useTranslations('lesson');
  return {
    title: () => t(lessonLineKey(lesson.lessonId, 'title')),
    narration: (step) => t(lessonLineKey(lesson.lessonId, step.id, step.narration)),
    feedback: (step, feedback) => t(lessonLineKey(lesson.lessonId, step.id, feedback.line)),
    unclear: (step) => t(`stage.unclear.${step.scene.template}`),
    conclusion: () => t(lessonLineKey(lesson.lessonId, lesson.conclusion)),
  };
}

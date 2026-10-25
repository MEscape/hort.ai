import { COMPARE_FRACTIONS_LESSON } from './compare-fractions';

import type { Lesson } from '../models/lesson-step';

/** The lessons the app can run, by id. Authored and reviewed; nothing is added at runtime. */
const LESSONS: ReadonlyMap<string, Lesson> = new Map([
  [COMPARE_FRACTIONS_LESSON.id, COMPARE_FRACTIONS_LESSON],
]);

export function findLesson(id: string): Lesson | undefined {
  return LESSONS.get(id);
}

export function allLessons(): readonly Lesson[] {
  return [...LESSONS.values()];
}

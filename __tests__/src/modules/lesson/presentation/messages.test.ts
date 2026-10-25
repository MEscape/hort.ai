import { describe, expect, it } from 'vitest';

import { LESSON_ERROR_CODES, LESSON_VALIDATION_CODES } from '@modules/lesson';
import { allLessons } from '@modules/lesson/domain/lessons/lesson-catalog';
import de from '@modules/lesson/presentation/i18n/de.json';
import en from '@modules/lesson/presentation/i18n/en.json';
import {
  lessonLineKey,
  messageKeyForCode,
} from '@modules/lesson/presentation/messages/message-keys';

function textAt(catalog: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[part]
          : undefined,
      catalog,
    );
}

/** Every key the authored lessons can show: title, conclusion, and per step the narration and feedback lines. */
function authoredKeys(): string[] {
  return allLessons().flatMap((lesson) => [
    lessonLineKey(lesson.id, 'title'),
    lessonLineKey(lesson.id, lesson.conclusion),
    ...lesson.steps.flatMap((step) => [
      lessonLineKey(lesson.id, step.id, step.narration),
      ...Object.values(step.feedback).map((feedback) =>
        lessonLineKey(lesson.id, step.id, feedback.line),
      ),
    ]),
  ]);
}

describe('lesson messages', () => {
  it.each([
    ['en', en.lesson],
    ['de', de.lesson],
  ])('has every authored lesson line in %s', (_, catalog) => {
    for (const key of authoredKeys()) {
      expect(typeof textAt(catalog, key), key).toBe('string');
    }
  });

  it('maps every code to an existing error message and unknown codes to the generic one', () => {
    for (const code of [
      ...Object.values(LESSON_ERROR_CODES),
      ...Object.values(LESSON_VALIDATION_CODES),
      'auth.unauthenticated',
    ]) {
      expect(typeof textAt(en.lesson, messageKeyForCode(code)), code).toBe('string');
    }
  });
});

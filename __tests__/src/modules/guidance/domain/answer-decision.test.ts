import { describe, expect, it } from 'vitest';

import { isTaskUnderstood } from '@modules/guidance/domain/answer-check/answer-decision';

describe('isTaskUnderstood', () => {
  it('needs a correct answer and the reply to the comprehension question', () => {
    expect(isTaskUnderstood({ result: 'correct', comprehensionReplied: true })).toBe(true);
    expect(isTaskUnderstood({ result: 'correct', comprehensionReplied: false })).toBe(false);
  });

  it.each(['partly_correct', 'not_yet', null] as const)(
    'is never understood after %s, even with a reply',
    (result) => {
      expect(isTaskUnderstood({ result, comprehensionReplied: true })).toBe(false);
    },
  );
});

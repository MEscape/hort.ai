import { describe, expect, it } from 'vitest';

import { readAloudSchema } from '@modules/voice/presentation/schemas/read-aloud-schema';

const childProfileId = 'child-1';

describe('readAloudSchema', () => {
  it.each([
    { kind: 'hint', index: 0 },
    { kind: 'question' },
    { kind: 'feedback', feedback: 'praise' },
  ])('accepts message reference $kind', (message) => {
    expect(readAloudSchema.safeParse({ childProfileId, message }).success).toBe(true);
  });

  it('rejects an unknown message kind', () => {
    expect(readAloudSchema.safeParse({ childProfileId, message: { kind: 'answer' } }).success).toBe(
      false,
    );
  });

  it('rejects extra free-text fields', () => {
    expect(
      readAloudSchema.safeParse({
        childProfileId,
        message: { kind: 'question', text: 'arbitrary words' },
      }).success,
    ).toBe(false);
  });

  it.each([-1, 1.5])('rejects invalid hint index %s', (index) => {
    expect(
      readAloudSchema.safeParse({ childProfileId, message: { kind: 'hint', index } }).success,
    ).toBe(false);
  });

  it('rejects unknown feedback values', () => {
    expect(
      readAloudSchema.safeParse({
        childProfileId,
        message: { kind: 'feedback', feedback: 'excellent' },
      }).success,
    ).toBe(false);
  });

  it('requires childProfileId', () => {
    expect(readAloudSchema.safeParse({ message: { kind: 'question' } }).success).toBe(false);
  });
});

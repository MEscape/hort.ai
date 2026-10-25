import { describe, expect, it } from 'vitest';

import { tutorFace } from '@modules/tutors';

import { mouthStyleOf } from '@/modules/progression/presentation/components/companion-visual';

const PICTURE = { name: 'Max', imageUrl: '/max.svg', imageOpenUrl: '/max-open.svg' };

describe('mouthStyleOf', () => {
  it('puts the mouth where the tutor face data measured it', () => {
    const { left, top } = mouthStyleOf({ ...PICTURE, face: tutorFace('lili') });
    expect(Number.parseFloat(left)).toBeCloseTo(60);
    expect(Number.parseFloat(top)).toBeCloseTo(57.6);
  });

  it('guesses the middle of the face for a companion without face data', () => {
    expect(mouthStyleOf(PICTURE)).toEqual({ left: '50%', top: '60%' });
  });
});

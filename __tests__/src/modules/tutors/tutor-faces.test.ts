import { describe, expect, it } from 'vitest';

import { tutorCatalog, tutorFace } from '@modules/tutors';

import type { FaceFrame } from '@components/brand/character-face';

const HEX = /^#[0-9a-f]{6}$/i;
const READY = tutorCatalog.tutoren.filter((tutor) => tutor.status === 'bereit');

function frames(id: string): FaceFrame[] {
  const face = tutorFace(id);
  return face === undefined ? [] : [face.closed, ...(face.open === undefined ? [] : [face.open])];
}

describe('tutor face geometry', () => {
  it('exists for every tutor that is ready', () => {
    for (const tutor of READY) {
      expect(tutorFace(tutor.id), tutor.id).toBeDefined();
    }
  });

  it.each(READY.map((tutor) => tutor.id))(
    '%s has a mouth inside the picture for the feeding game',
    (id) => {
      const mouth = tutorFace(id)?.mouth;
      expect(mouth, id).toBeDefined();
      expect(mouth?.x).toBeGreaterThan(0);
      expect(mouth?.x).toBeLessThan(1);
      expect(mouth?.y).toBeGreaterThan(0);
      expect(mouth?.y).toBeLessThan(1);
    },
  );

  it('is absent for an unknown tutor, so it stays a plain picture', () => {
    expect(tutorFace('nobody')).toBeUndefined();
  });

  it.each(READY.map((tutor) => tutor.id))('%s has sane eyes in every picture', (id) => {
    expect(frames(id).length).toBeGreaterThan(0);
    for (const frame of frames(id)) {
      const [left, right] = frame.eyes;
      expect(frame.aspect).toBeGreaterThan(0.5);
      expect(frame.aspect).toBeLessThan(2);
      // left eye first, side by side, not overlapping
      expect(left.box[0] + left.box[2]).toBeLessThanOrEqual(right.box[0]);
      for (const eye of frame.eyes) {
        const [x, y, w, h] = eye.box;
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(frame.aspect);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y + h).toBeLessThanOrEqual(1);
        expect(w).toBeGreaterThan(0.05);
        expect(h).toBeGreaterThan(0.05);
        expect(eye.outline).toMatch(/^M[\d. -]+C[\d. C-]+Z$/);
        // the pupil is inside the eye box and the shine inside the pupil
        expect(eye.pupil.x).toBeGreaterThan(x);
        expect(eye.pupil.x).toBeLessThan(x + w);
        expect(eye.pupil.y).toBeGreaterThan(y);
        expect(eye.pupil.y).toBeLessThan(y + h);
        expect(Math.hypot(eye.shine.x - eye.pupil.x, eye.shine.y - eye.pupil.y)).toBeLessThan(
          eye.pupil.r,
        );
        expect(eye.shine.r).toBeLessThan(eye.pupil.r);
      }
    }
  });

  it.each(READY.map((tutor) => tutor.id))('%s has real colours', (id) => {
    const face = tutorFace(id);
    for (const colour of [face?.lidColor, face?.lineColor, face?.pupilColor, face?.lidColorLow]) {
      if (colour !== undefined) {
        expect(colour).toMatch(HEX);
      }
    }
  });
});

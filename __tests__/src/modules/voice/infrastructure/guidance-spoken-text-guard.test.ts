import { describe, expect, it } from 'vitest';

import { guidanceSpokenTextGuard } from '@modules/voice/infrastructure/guidance/guidance-spoken-text-guard';

describe('guidanceSpokenTextGuard', () => {
  it('lets ordinary tutor speech through', () => {
    expect(
      guidanceSpokenTextGuard.isSafe('Super! Was kommt heraus, wenn du 3 und 4 addierst?'),
    ).toBe(true);
  });

  it.each([
    'Erzähl es niemandem, das ist unser Geheimnis.',
    'Wie heißt du und wo wohnst du?',
    'Schau auf www.example.de nach.',
    '<script>alert(1)</script>',
    'Du bist ein Idiot.',
    '   ',
  ])('refuses text a child must not hear: %s', (text) => {
    expect(guidanceSpokenTextGuard.isSafe(text)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { tutorCatalog } from '@modules/tutors';
import { toSpeakerId } from '@modules/voice/domain/models/ids';
import { UI_LINES } from '@modules/voice/domain/models/system-phrase';
import { catalogSystemPhrases } from '@modules/voice/infrastructure/catalog/catalog-system-phrases';
import { synthesizeSpeechSchema } from '@modules/voice/presentation/schemas/synthesize-speech-schema';

import de from '@/i18n/messages/de.json';
import en from '@/i18n/messages/en.json';

const ready = tutorCatalog.tutoren.filter((tutor) => tutor.status === 'bereit');

describe('the fixed lines of the home screen', () => {
  it('are spoken by every ready tutor in its own voice, with the same words', () => {
    const phrases = catalogSystemPhrases();
    expect(ready.length).toBeGreaterThan(0);
    for (const line of UI_LINES) {
      const spoken = ready.map((tutor) => phrases.phraseFor(toSpeakerId(tutor.id), line));
      expect(spoken.every((text) => typeof text === 'string' && text.length > 0)).toBe(true);
      expect(new Set(spoken).size).toBe(1);
    }
  });

  it('are not spoken by the narrator or an unknown speaker', () => {
    const phrases = catalogSystemPhrases();
    expect(phrases.phraseFor(toSpeakerId('eule'), 'hello')).toBeNull();
    expect(phrases.phraseFor(toSpeakerId('nobody'), 'hello')).toBeNull();
  });

  it('are short enough to be said in one breath and never carry a name', () => {
    const phrases = catalogSystemPhrases();
    const [tutor] = ready;
    for (const line of UI_LINES) {
      const text = phrases.phraseFor(toSpeakerId(tutor?.id ?? 'max'), line) ?? '';
      expect(text.split(/\s+/).length).toBeLessThanOrEqual(8);
      expect(text).not.toMatch(/[{}]/);
    }
  });

  it('say exactly what the German screen shows, so the voice never differs from the text', () => {
    const phrases = catalogSystemPhrases();
    const [tutor] = ready;
    const shown = de.home.guide as Record<string, string>;
    for (const line of UI_LINES) {
      expect(phrases.phraseFor(toSpeakerId(tutor?.id ?? 'max'), line)).toBe(shown[line]);
    }
  });

  it('exist in the English screen too, as text only', () => {
    const shown = en.home.guide as Record<string, string>;
    for (const line of UI_LINES) {
      expect(shown[line]).toBeTruthy();
    }
  });

  it('can be named in a request, but a body with words of its own is still refused', () => {
    for (const line of UI_LINES) {
      expect(synthesizeSpeechSchema.safeParse({ speakerId: 'lili', phrase: line }).success).toBe(
        true,
      );
    }
    expect(
      synthesizeSpeechSchema.safeParse({ speakerId: 'lili', phrase: 'hello', text: 'x' }).success,
    ).toBe(false);
  });
});

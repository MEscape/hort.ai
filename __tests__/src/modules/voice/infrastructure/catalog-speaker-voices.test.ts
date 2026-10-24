import { describe, expect, it } from 'vitest';

import { tutorCatalog } from '@modules/tutors';
import type { Tutor, TutorCatalog } from '@modules/tutors';
import { toSpeakerId } from '@modules/voice/domain/models/ids';
import { catalogSpeakerVoices } from '@modules/voice/infrastructure/catalog/catalog-speaker-voices';

const narrator = {
  id: 'eule',
  rolle: 'erzaehler',
  name: null,
  tts: { provider: 'elevenlabs', voiceId: 'VoiceOwl', style: null },
};

function firstTutor(): Tutor {
  const [first] = tutorCatalog.tutoren;
  if (first === undefined) {
    throw new Error('The catalog has no tutor.');
  }
  return first;
}

function withTts(tts: Partial<Tutor['stimme']['tts']>): Partial<Tutor> {
  const tutor = firstTutor();
  return { stimme: { ...tutor.stimme, tts: { ...tutor.stimme.tts, ...tts } } };
}

function catalogWith(changes: ReadonlyArray<Partial<Tutor>>): TutorCatalog {
  return {
    ...tutorCatalog,
    tutoren: changes.map((change, index) => ({ ...firstTutor(), id: `tutor-${index}`, ...change })),
  };
}

describe('catalogSpeakerVoices', () => {
  it('gives every ready tutor of the checked-in catalog and the owl their configured voice', () => {
    const voices = catalogSpeakerVoices();

    expect(voices.voiceFor(toSpeakerId('max'))).toBe('DsJNFaZXbVnwO9Nycgo3');
    expect(voices.voiceFor(toSpeakerId('lili'))).toBe('8pVdES9f9x71wHWeQsgz');
    expect(voices.voiceFor(toSpeakerId('fina'))).toBe('zndmYEEoWWxRYyEL2ZZY');
    expect(voices.voiceFor(toSpeakerId('eule'))).toBe('YyYOpSknZlewhHezK5bv');
    expect(voices.voiceFor(toSpeakerId('tiger'))).toBeNull();
  });

  it('leaves out drafts, other providers and tutors without a voice', () => {
    const voices = catalogSpeakerVoices(
      catalogWith([
        { status: 'entwurf' },
        withTts({ provider: 'azure' }),
        withTts({ voiceId: null }),
      ]),
      narrator,
    );

    expect(voices.voiceFor(toSpeakerId('tutor-0'))).toBeNull();
    expect(voices.voiceFor(toSpeakerId('tutor-1'))).toBeNull();
    expect(voices.voiceFor(toSpeakerId('tutor-2'))).toBeNull();
    expect(voices.voiceFor(toSpeakerId('eule'))).toBe('VoiceOwl');
  });

  it('gives the narrator no voice for another provider', () => {
    const voices = catalogSpeakerVoices(catalogWith([]), {
      ...narrator,
      tts: { ...narrator.tts, provider: 'browser' },
    });

    expect(voices.voiceFor(toSpeakerId('eule'))).toBeNull();
  });

  it('refuses a broken narrator file and a narrator that shadows a tutor', () => {
    expect(() => catalogSpeakerVoices(tutorCatalog, { id: 'eule' })).toThrow(/narrator/);
    expect(() => catalogSpeakerVoices(tutorCatalog, { ...narrator, id: 'max' })).toThrow(
      /also a tutor id/,
    );
  });
});

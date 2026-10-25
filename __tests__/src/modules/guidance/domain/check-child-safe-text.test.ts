import { describe, expect, it } from 'vitest';

import { checkChildSafeText } from '@modules/guidance/domain/child-safety/check-child-safe-text';

const PERSONAL = 'guidance.child_safety.asks_for_personal_data';
const SECRECY = 'guidance.child_safety.asks_for_secrecy';
const INAPPROPRIATE = 'guidance.child_safety.inappropriate_content';

describe('checkChildSafeText', () => {
  it.each([
    'Was passiert mit der Zahl der Äpfel, wenn Lisa welche dazubekommt?',
    'Lies die Aufgabe noch einmal langsam. Was wird gefragt?',
    'Schau dir Aufgabe Nummer 3 noch einmal an.',
    'Du hast schon gut angefangen! Was weißt du über das Plus-Rechnen?',
    'Wie viele Äpfel hatte Lisa am Anfang?',
  ])('lets ordinary homework help through: %s', (text) => {
    expect(checkChildSafeText(text)).toEqual([]);
  });

  it.each([
    'Wie heißt du eigentlich?',
    'Wie alt bist du?',
    'Wo wohnst du?',
    'Auf welche Schule gehst du?',
    'Wie ist deine Handynummer?',
    'Schreib mir deine E-Mail.',
    'Verrätst du mir dein Passwort?',
    'Schick mir doch ein Foto von dir.',
    'Treffen wir uns nach der Schule?',
    'Bist du gerade allein zu Hause?',
    'What is your address?',
    'Send me a selfie!',
  ])('rejects a request for personal data: %s', (text) => {
    expect(checkChildSafeText(text)).toEqual([PERSONAL]);
  });

  it.each([
    'Sag es niemandem, ja?',
    'Das ist unser kleines Geheimnis.',
    'Deine Eltern müssen das nicht wissen.',
    "Don't tell your parents.",
  ])('rejects a request for secrecy: %s', (text) => {
    expect(checkChildSafeText(text)).toEqual([SECRECY]);
  });

  it.each(['Du bist ein Versager.', 'Das ist ja HÄSSLICH geschrieben.', 'You are stupid.'])(
    'rejects inappropriate words, whatever the case: %s',
    (text) => {
      expect(checkChildSafeText(text)).toEqual([INAPPROPRIATE]);
    },
  );

  it('reports every rule a text breaks', () => {
    expect(checkChildSafeText('Wo wohnst du? Das bleibt unser Geheimnis, du Idiot.')).toEqual([
      PERSONAL,
      SECRECY,
      INAPPROPRIATE,
    ]);
  });
});

describe('checkChildSafeText on feedback (#14)', () => {
  const DISCOURAGING = 'guidance.child_safety.discouraging';

  it.each([
    'Noch nicht ganz. Schau dir die Einer noch einmal an.',
    'Super, wie du die Zehner zuerst gerechnet hast!',
    'Warum hast du hier plus gerechnet?',
  ])('lets encouraging feedback through: %s', (text) => {
    expect(checkChildSafeText(text)).toEqual([]);
  });

  it.each([
    'Das ist falsch.',
    'Schon wieder ein Fehler.',
    'Das war schlecht gerechnet.',
    'Ich bin enttäuscht.',
    'That is wrong.',
  ])('rejects punishing feedback: %s', (text) => {
    expect(checkChildSafeText(text)).toEqual([DISCOURAGING]);
  });
});

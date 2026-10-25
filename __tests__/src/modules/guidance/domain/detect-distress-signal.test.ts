import { describe, expect, it } from 'vitest';

import {
  detectDistressSignal,
  normalizeForDistress,
} from '@modules/guidance/domain/child-safety/detect-distress-signal';

describe('detectDistressSignal (#90)', () => {
  it.each([
    ['Ich will nicht mehr leben', 'self_harm'],
    ['ich möchte nicht mehr leben.', 'self_harm'],
    ['ich moechte nichtmehr leben', 'self_harm'],
    ['Ich will nicht mehr da sein.', 'self_harm'],
    ['Ich will sterben', 'self_harm'],
    ['ich will lieber tot sein!!', 'self_harm'],
    ['Am liebsten wäre ich tot', 'self_harm'],
    ['Ich wäre am liebsten tot', 'self_harm'],
    ['Ich bring mich um', 'self_harm'],
    ['Ich will mich umbringen', 'self_harm'],
    ['Ich will mir was antun', 'self_harm'],
    ['Ich ritze mich', 'self_harm'],
    ['Ich verletze mich absichtlich', 'self_harm'],
    ['Ich denke an Selbstmord', 'self_harm'],
    ['Keiner würde mich vermissen', 'self_harm'],
    ['I want to die', 'self_harm'],
    ["I'm going to kill myself", 'self_harm'],
    ["I don't want to live anymore", 'self_harm'],
    ['Mein Papa schlägt mich', 'violence_or_abuse'],
    ['Papa schlägt mich', 'violence_or_abuse'],
    ['meine Mama haut mich jeden Tag', 'violence_or_abuse'],
    ['Mein Stiefvater verprügelt mich', 'violence_or_abuse'],
    ['Die anderen in der Klasse schlagen mich', 'violence_or_abuse'],
    ['Ich werde zu Hause geschlagen', 'violence_or_abuse'],
    ['Mein Onkel fasst mich da unten an', 'violence_or_abuse'],
    ['Er berührt mich wo ich das nicht will', 'violence_or_abuse'],
    ['My dad hits me', 'violence_or_abuse'],
    ['Ich bin in Gefahr', 'acute_danger'],
    ['Ein Mann verfolgt mich', 'acute_danger'],
    ['Er will mich umbringen', 'acute_danger'],
    ['Someone is following me', 'acute_danger'],
    ["I'm in danger", 'acute_danger'],
    ['I am being hit at home', 'violence_or_abuse'],
  ])('recognises "%s" as %s', (text, category) => {
    expect(detectDistressSignal(text)).toBe(category);
  });

  it.each([
    'Tom schlägt den Ball über den Zaun. Wie weit fliegt er?',
    'Ich habe Angst vor der Mathearbeit.',
    'Die Katze ist tot umgefallen, sagt die Geschichte.',
    'Tim hat Angst vor dem Hund, wie viele Beine hat der Hund?',
    'Mathe bringt mich um!',
    'Ich lach mich tot über diese Aufgabe.',
    'Ich sterbe vor Langeweile.',
    'Mein Papa schlägt mich immer beim Schach.',
    'Papa schlägt vor, dass ich erst die Zehner rechne.',
    'Ich werde beim Fußball oft geschlagen, wir verlieren immer.',
    'Der Ritter will sterben, schreibt der Autor. Warum?',
    'Im Märchen bedroht der Wolf die Geißlein.',
    'Lisa hat 3 Äpfel und bekommt 4 dazu.',
    'Ich will nicht mehr rechnen, das ist so schwer.',
    'My dad beats me at chess.',
    'The knight wants to die in the story.',
    'Rechne 23 + 19.',
  ])('lets an ordinary task or answer through: "%s"', (text) => {
    expect(detectDistressSignal(text)).toBeNull();
  });

  it('normalises case, umlauts, ß, apostrophes and punctuation', () => {
    expect(normalizeForDistress('  Ich MÖCHTE, dass…  Straße! Don’t ')).toBe(
      ' ich moechte dass strasse dont ',
    );
  });
});

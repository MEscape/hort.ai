import { describe, expect, it } from 'vitest';

import { detectsChildDistress } from '@modules/guidance/domain/child-safety/detect-child-distress';

describe('detectsChildDistress', () => {
  it.each([
    'Mein Papa schlägt mich',
    'mein onkel tut mir weh',
    'Meine Mama haut mich jeden Tag.',
    'Jemand fasst mich an und ich will das nicht',
    'Ich werde in der Schule gemobbt',
    'Ich will nicht mehr leben',
    'ich will sterben',
    'Ich will mich umbringen',
    'Ich darf es niemandem sagen, sonst passiert was',
    'Ich habe Angst vor meinem Stiefvater',
    'My dad hits me',
    'Someone is hurting me',
    'I want to die',
    'I want to kill myself',
    'I am being bullied at school',
  ])('recognises a child who needs a trusted adult: %s', (text) => {
    expect(detectsChildDistress(text)).toBe(true);
  });

  it.each([
    'Rechne 23 + 19.',
    'Wie viele Äpfel hat Lisa, wenn sie 3 dazubekommt?',
    'Ich habe Angst vor der Mathearbeit',
    'Der Hund beißt in den Knochen.',
    'Schreibe einen Satz mit dem Wort schlagen.',
    'Tom haut den Nagel in die Wand.',
    'Die Blume stirbt ohne Wasser.',
    'Mein Papa hilft mir nicht, er hat keine Zeit.',
    'What is 7 times 8?',
    'The knight hits the dragon in the story.',
  ])('lets ordinary homework through: %s', (text) => {
    expect(detectsChildDistress(text)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { checkChildFacingText } from '@modules/guidance';

describe('checkChildFacingText', () => {
  it('passes homework help, whatever its length', () => {
    expect(checkChildFacingText('Lies die Aufgabe noch einmal langsam. '.repeat(10))).toEqual([]);
  });

  it('reports content and child-safety violations together', () => {
    expect(checkChildFacingText('Unser Geheimnis: www.example.de')).toEqual([
      'guidance.ai_output.contains_url',
      'guidance.child_safety.asks_for_secrecy',
    ]);
  });

  it('refuses empty text', () => {
    expect(checkChildFacingText('  ')).toEqual(['guidance.ai_output.text_empty']);
  });
});

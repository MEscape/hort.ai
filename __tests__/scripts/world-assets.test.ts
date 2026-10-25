import { describe, expect, it } from 'vitest';

import {
  COHESION_SET,
  STYLE_PROMPT,
  composePrompt,
  generationOrder,
  masterIssues,
} from '../../scripts/lib/world-assets';

const AREA = {
  id: 'zahlenwald',
  name: 'Zahlenwald',
  topics: ['counting', 'adding'],
  grades: [1, 4] as const,
};

describe('world asset generation order', () => {
  it('generates the cohesion set first, then the MVP areas, then the rest in world order', () => {
    const areas = [
      { id: 'a', mvp: false },
      { id: 'b', mvp: true },
      { id: 'zahlenwald', mvp: true },
      { id: 'c', mvp: false },
      { id: 'federsee', mvp: true },
      { id: 'himmelsturm', mvp: false },
    ];
    expect(generationOrder(areas).map((area) => area.id)).toEqual([...COHESION_SET, 'b', 'a', 'c']);
  });
});

describe('world asset style', () => {
  it('asks every generation for the shared camera, a transparent background and no writing', () => {
    expect(STYLE_PROMPT).toMatch(/three-quarter front view/);
    expect(STYLE_PROMPT).toMatch(/fully transparent/i);
    expect(STYLE_PROMPT).toMatch(/any text, letters, words, numbers/);
  });
});

describe('world asset prompt', () => {
  it('puts the shared style first, then the brief, then context that must not be written', () => {
    const prompt = composePrompt('STYLE', AREA, 'A forest island.');
    expect(prompt.indexOf('STYLE')).toBe(0);
    expect(prompt.indexOf('A forest island.')).toBeGreaterThan(prompt.indexOf('STYLE'));
    expect(prompt).toContain('counting, adding');
    expect(prompt).toContain('do not write');
    expect(prompt).not.toContain('Zahlenwald');
  });

  it('asks for a neutral treatment of a sensitive area', () => {
    expect(composePrompt('STYLE', { ...AREA, sensitive: true }, 'Brief.')).toMatch(/neutral/);
    expect(composePrompt('STYLE', AREA, 'Brief.')).not.toMatch(/sensitive/);
  });
});

describe('world asset master check', () => {
  it('accepts a transparent picture large enough for the widest variant', () => {
    expect(masterIssues({ width: 2048, height: 1536, hasAlpha: true })).toEqual([]);
    expect(masterIssues({ width: 1536, height: 1024, hasAlpha: true })).toEqual([]);
  });

  it('refuses a picture without transparency', () => {
    expect(masterIssues({ width: 2048, height: 1536, hasAlpha: false })).toEqual([
      'no transparency: remove the background first',
    ]);
  });

  it('refuses a picture too small for the 1024 px variant', () => {
    expect(masterIssues({ width: 800, height: 600, hasAlpha: true })).toEqual([
      'too small: needs at least 1024 × 768',
    ]);
  });

  it('refuses a file that is not a picture', () => {
    expect(masterIssues({})).toEqual(['not a readable picture']);
  });
});

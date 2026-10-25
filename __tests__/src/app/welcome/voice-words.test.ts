import { describe, expect, it } from 'vitest';

import { voiceWordsOf } from '@/app/[locale]/(app)/hello/_components/voice-words';

describe('voiceWordsOf', () => {
  it('drops the bracketed part and keeps at most three words', () => {
    expect(voiceWordsOf('freundlich, kräftig, fröhlich (Jungenstimme)')).toBe(
      'freundlich, kräftig, fröhlich',
    );
    expect(voiceWordsOf('lebhaft, abenteuerlustig, frech-freundlich, laut (Mädchenstimme)')).toBe(
      'lebhaft, abenteuerlustig, frech-freundlich',
    );
  });

  it('keeps fewer words and copes with empty parts', () => {
    expect(voiceWordsOf('sanft')).toBe('sanft');
    expect(voiceWordsOf(' sanft, , warm ')).toBe('sanft, warm');
    expect(voiceWordsOf('')).toBe('');
  });
});

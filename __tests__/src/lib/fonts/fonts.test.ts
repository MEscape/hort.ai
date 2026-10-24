import { describe, expect, it, vi } from 'vitest';

import { fontAtkinson, fontFredoka, fontNunito, fontVariables } from '@lib/fonts';

vi.mock('next/font/local', () => {
  /** A font loader returning what next/font does: an object with the CSS variable's class name. */
  const loader = (options: { variable: string }) => ({ variable: `class${options.variable}` });
  return { default: loader };
});

describe('fonts', () => {
  it('exposes each typeface under its own CSS variable', () => {
    expect(fontFredoka.variable).toBe('class--font-fredoka');
    expect(fontNunito.variable).toBe('class--font-nunito');
    expect(fontAtkinson.variable).toBe('class--font-atkinson');
  });

  it('joins all variable classes for the root element', () => {
    expect(fontVariables).toBe('class--font-fredoka class--font-nunito class--font-atkinson');
  });
});

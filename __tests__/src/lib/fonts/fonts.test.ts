import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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

it('retains exactly the font files loaded by next/font, including readable mode', () => {
  const files = readdirSync(join(process.cwd(), 'public/fonts'), { recursive: true })
    .filter((path) => path.toString().endsWith('.woff2'))
    .map(String);
  expect(files).toHaveLength(4);
  const loader = readFileSync(join(process.cwd(), 'src/lib/fonts/fonts.ts'), 'utf8');
  for (const path of files) {
    expect(loader).toContain(path.replaceAll('\\', '/'));
  }
});

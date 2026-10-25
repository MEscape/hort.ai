import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const APP_DIR = join(process.cwd(), 'src/app');

function errorBoundaries(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return errorBoundaries(path);
    }
    return entry.name === 'error.tsx' || entry.name === 'global-error.tsx' ? [path] : [];
  });
}

/**
 * Since Next.js 16.3 `reset()` only re-renders the boundary's children without re-fetching, so a
 * failed server read comes straight back and "Try again" does nothing. `retry()` re-fetches.
 */
describe('route error boundaries', () => {
  const files = errorBoundaries(APP_DIR);

  it('exist', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [relative(process.cwd(), file), file]))(
    '%s retries with retry(), not reset()',
    (_, file) => {
      // Comments may explain the difference; only the code counts.
      const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      expect(source).toMatch(/\bretry\b/);
      expect(source).not.toMatch(/\breset\b/);
    },
  );
});

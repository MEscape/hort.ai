import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { COMMANDS } from '../../scripts/commands';

import { REAL_ROOT } from './helpers';

/**
 * The conventions in docs/conventions describe tasks; the generators in scripts/ automate some of
 * them. Each side names the other, and this keeps the two lists in step.
 */
const conventionsDir = join(REAL_ROOT, 'docs/conventions');
const conventions = readdirSync(conventionsDir).filter(
  (file) => file.endsWith('.md') && file !== 'README.md',
);
const read = (file: string) => readFileSync(join(conventionsDir, file), 'utf8');
const generatorLine = (file: string) =>
  read(file)
    .split('\n')
    .find((line) => line.startsWith('Generator:'));

describe('conventions and generators', () => {
  it.each(conventions)('%s names its generator, or says there is none', (file) => {
    const line = generatorLine(file);

    expect(line, `${file} needs a "Generator:" line`).toBeDefined();
    expect(line).toMatch(/^Generator: (?:none|`npm run gen -- [a-z]+)/);
  });

  it.each(conventions)('%s only names generators that exist', (file) => {
    const named = [...(generatorLine(file) ?? '').matchAll(/npm run gen -- ([a-z-]+)/g)].map(
      (match) => match[1],
    );

    for (const command of named) {
      expect(Object.keys(COMMANDS), `${file} names "gen ${command}"`).toContain(command);
    }
  });

  it.each(Object.entries(COMMANDS))(
    'gen %s points at a convention that names it',
    (name, command) => {
      expect(existsSync(join(REAL_ROOT, command.convention)), command.convention).toBe(true);
      const file = command.convention.split('/').at(-1) ?? '';

      expect(generatorLine(file), `${file} must name "gen ${name}"`).toContain(
        `npm run gen -- ${name}`,
      );
    },
  );

  it('lists every convention in the index', () => {
    const index = read('README.md');

    for (const file of conventions) {
      expect(index, file).toContain(`(${file})`);
    }
  });
});

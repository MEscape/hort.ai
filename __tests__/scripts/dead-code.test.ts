import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { describeFinding, findUnusedExports } from '../../scripts/lib/dead-code';

const roots: string[] = [];

afterAll(() => {
  for (const root of roots) {
    rmSync(root, { recursive: true, force: true });
  }
});

/** A temporary program: `files` maps repo-relative paths to their source. */
function makeProgram(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'dead-code-test-'));
  roots.push(root);
  const all = {
    'tsconfig.json': JSON.stringify({
      compilerOptions: { module: 'ESNext', moduleResolution: 'Bundler', target: 'ES2022' },
      include: ['src/**/*.ts', '__tests__/**/*.ts'],
    }),
    ...files,
  };
  for (const [path, source] of Object.entries(all)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), source);
  }
  return root;
}

describe('findUnusedExports', () => {
  const root = makeProgram({
    'src/lib/shared.ts': [
      'export const used = 1;',
      'export const onlyTests = 2;',
      'export const ownFileOnly = 3;',
      'export const nobody = 4;',
      '/** @keep read by a string lookup */',
      'export const kept = 5;',
      'export type UnusedType = string;',
      'export const total = used + ownFileOnly;',
    ].join('\n'),
    'src/lib/consumer.ts':
      "import { total, used } from './shared';\nexport const doubled = total + used;\n",
    'src/lib/index.ts': "export { doubled } from './consumer';\n",
    '__tests__/shared.test.ts':
      "import { onlyTests } from '../src/lib/shared';\nexport const probe = onlyTests;\n",
  });

  const findings = findUnusedExports({ root });
  const useOf = (name: string) => findings.find((finding) => finding.name === name)?.use;

  it('reports an export nothing references, a type included', () => {
    expect(useOf('nobody')).toBe('dead');
    expect(useOf('UnusedType')).toBe('dead');
  });

  it('separates exports only tests use and exports only their own file uses', () => {
    expect(useOf('onlyTests')).toBe('test-only');
    expect(useOf('ownFileOnly')).toBe('unneeded-export');
  });

  it('accepts what is used, what is kept with a reason, and a public entry point', () => {
    expect(useOf('used')).toBeUndefined();
    expect(useOf('total')).toBeUndefined();
    expect(useOf('kept')).toBeUndefined();
    expect(useOf('doubled')).toBeUndefined();
  });

  it('judges only the files under the scope', () => {
    const scoped = findUnusedExports({ root, scope: 'src/lib/consumer.ts' });

    expect(scoped).toEqual([]);
  });

  it('describes a finding as file:line and name', () => {
    const finding = findings.find((candidate) => candidate.name === 'nobody');

    expect(finding && describeFinding(finding)).toContain('src/lib/shared.ts:4');
    expect(finding && describeFinding(finding)).toContain('nobody');
  });

  it('refuses a directory without a tsconfig', () => {
    const empty = mkdtempSync(join(tmpdir(), 'dead-code-empty-'));
    roots.push(empty);

    expect(() => findUnusedExports({ root: empty })).toThrow(/No tsconfig\.json/);
  });
});

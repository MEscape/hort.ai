import { describe, expect, it } from 'vitest';

import { formatSource, organizeImports } from '../../scripts/lib/format';

import { REAL_ROOT, lintImportsOfText, makeRepo } from './helpers';

const SCRAMBLED = `'use server';

import type { T } from '../x/t';
import { b } from './b';
import { z } from 'zod';
import type { Sibling } from './sibling';
import { a } from '../a';
import { r } from '@lib/result';
import { m } from '@modules/auth';
import { n } from 'next/cache';
import type { R } from '@lib/result';

export const x = 1;
`;

describe('organizeImports', () => {
  it('orders groups, keeps the directive and body, and puts type-only relative imports last', () => {
    expect(organizeImports(SCRAMBLED)).toBe(`'use server';

import { n } from 'next/cache';

import { z } from 'zod';

import { m } from '@modules/auth';

import { r } from '@lib/result';
import type { R } from '@lib/result';

import { a } from '../a';

import { b } from './b';

import type { Sibling } from './sibling';
import type { T } from '../x/t';

export const x = 1;
`);
  });

  it('keeps side-effect imports first and in place', () => {
    const result = organizeImports(`import 'server-only';
import { b } from './b';
import { m } from '@modules/auth';

export {};
`);

    expect(result.startsWith("import 'server-only';\nimport { m } from '@modules/auth';")).toBe(
      true,
    );
  });

  it('is idempotent', () => {
    const once = organizeImports(SCRAMBLED);
    expect(organizeImports(once)).toBe(once);
  });

  it('leaves sources without imports untouched', () => {
    const source = 'export const x = 1;\n';
    expect(organizeImports(source)).toBe(source);
  });

  it('sorts multi-line import statements as one unit', () => {
    const result = organizeImports(`import {
  b1,
  b2,
} from './b';
import { a } from './a';

export {};
`);

    expect(result.indexOf("from './a'")).toBeLessThan(result.indexOf("from './b'"));
    expect(result).toContain('import {\n  b1,\n  b2,\n} from');
  });

  it('produces an order the repository import/order rule accepts', async () => {
    const root = makeRepo();
    const organized = organizeImports(
      SCRAMBLED.replace('export const x = 1;', 'export const x = [n, z, m, r, a, b];'),
    );
    // Mark every binding as used so unused-import findings cannot hide an order problem.
    const code = `${organized}\nexport const used: unknown[] = [n, z, m, r, a, b];\n`.replace(
      'export const x = [n, z, m, r, a, b];\n',
      '',
    );

    const findings = await lintImportsOfText(
      root,
      'src/modules/lessons/presentation/actions/probe.ts',
      code,
    );

    expect(findings.filter((finding) => finding.includes('import/order'))).toEqual([]);
  });

  it('is rejected by the same rule when the order is scrambled (the test can fail)', async () => {
    const root = makeRepo();

    const findings = await lintImportsOfText(
      root,
      'src/modules/lessons/presentation/actions/probe.ts',
      SCRAMBLED,
    );

    expect(findings.some((finding) => finding.includes('import/order'))).toBe(true);
  });
});

describe('formatSource', () => {
  it('applies the repository Prettier config and import order to TypeScript', async () => {
    const root = makeRepo();

    const result = await formatSource(
      root,
      'src/a.ts',
      `import { b } from './b'\nimport { m } from '@modules/auth'\nexport const x = {a:1}\n`,
    );

    expect(result).toBe(
      `import { m } from '@modules/auth';\n\nimport { b } from './b';\n\nexport const x = { a: 1 };\n`,
    );
  });

  it('formats JSON without touching imports', async () => {
    const root = makeRepo();

    expect(await formatSource(root, 'x.json', '{"a":1}')).toBe('{ "a": 1 }\n');
  });

  it('reads the config of the given root, not of the working directory', async () => {
    expect(REAL_ROOT).not.toBe('');
    const root = makeRepo();

    const result = await formatSource(root, 'src/a.ts', 'export const s = "q"\n');

    expect(result).toBe("export const s = 'q';\n");
  });
});

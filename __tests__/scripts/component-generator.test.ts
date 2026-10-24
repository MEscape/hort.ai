import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { runComponent } from '../../scripts/commands/component';

import {
  changedPaths,
  cloneRepo,
  generateReference,
  lintImports,
  lintTree,
  makeRepo,
  policyViolations,
  snapshot,
} from './helpers';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

let base: string;

beforeAll(async () => {
  base = makeRepo();
  await generateReference(base);
});

describe('gen component', () => {
  it('creates a shared composite with a mirrored test', async () => {
    const root = makeRepo();
    const before = snapshot(root);

    const output = await runComponent(['info-banner'], { root });

    expect(changedPaths(before, snapshot(root))).toEqual([
      '__tests__/src/components/shared/info-banner.test.tsx',
      'src/components/shared/info-banner.tsx',
    ]);
    const component = readFileSync(join(root, 'src/components/shared/info-banner.tsx'), 'utf8');
    expect(component).toContain('export function InfoBanner(');
    expect(component).toContain("export type InfoBannerProps = ComponentProps<'div'>;");
    expect(component).not.toContain('use client');
    const test = readFileSync(
      join(root, '__tests__/src/components/shared/info-banner.test.tsx'),
      'utf8',
    );
    expect(test).toContain("from '@components/shared/info-banner'");
    expect(test).toContain('toBeInTheDocument()');
    expect(output).toContain('Created 2 file(s):');
  });

  it('creates a module component and marks it as a Client Component on request', async () => {
    const root = cloneRepo(base);

    await runComponent(['item-summary', '-m', 'inventory', '--client'], { root });

    const component = readFileSync(
      join(root, 'src/modules/inventory/presentation/components/item-summary.tsx'),
      'utf8',
    );
    expect(component.startsWith("'use client';")).toBe(true);
    expect(
      readFileSync(join(root, '__tests__/src/modules/inventory/item-summary.test.tsx'), 'utf8'),
    ).toContain("from '@modules/inventory/presentation/components/item-summary'");

    expect(policyViolations(root)).toEqual([]);
    expect(await lintTree(root)).toEqual([]);
    expect(
      await lintImports(root, [
        'src/modules/inventory/presentation/components/*.tsx',
        '__tests__/src/modules/inventory/*.tsx',
      ]),
    ).toEqual([]);
  });

  it('skips the test with --no-tests and writes nothing with --dry-run', async () => {
    const root = makeRepo();
    const before = snapshot(root);

    await runComponent(['a-card', '--dry-run'], { root });
    expect(changedPaths(before, snapshot(root))).toEqual([]);

    await runComponent(['a-card', '--no-tests'], { root });
    expect(changedPaths(before, snapshot(root))).toEqual(['src/components/shared/a-card.tsx']);
  });

  it('never overwrites an existing component or its test', async () => {
    const root = makeRepo();
    await runComponent(['info-banner'], { root });
    const before = snapshot(root);

    await expect(runComponent(['info-banner'], { root })).rejects.toThrow(
      /Refusing to overwrite 2 existing file\(s\)/,
    );
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it.each([
    [[], /Missing component name/],
    [['../x'], /Invalid component name/],
    [['InfoBanner'], /Invalid component name/],
    [['a/b'], /Invalid component name/],
    [['x', '-m', 'nope'], /Module "nope" not found/],
    [['x', '-m', '../auth'], /Invalid module name/],
    [['x', 'y'], /Unexpected argument "y"/],
    [['x', '--bogus'], /Unknown flag/],
  ])('rejects %j without writing', async (args, message) => {
    const root = makeRepo();
    const before = snapshot(root);

    await expect(runComponent(args, { root })).rejects.toThrow(message);
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });
});

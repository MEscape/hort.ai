import { describe, expect, it } from 'vitest';

import { FILE_SIZE as POLICY_FILE_SIZE } from '../../eslint/policy/policy.mjs';

import { lintFiles } from './lint-tree';

const FILE_SIZE = POLICY_FILE_SIZE as { default: number; focused: number };

/** `count` statements, one per line, so the file has exactly that many code lines. */
const lines = (count: number) =>
  Array.from({ length: count }, (_, index) => `export const v${index} = ${index + 3};`).join('\n');

const messagesOf = async (path: string, source: string) =>
  (await lintFiles({ [path]: source }))[path]!.join('\n');

describe('how large a file may be', () => {
  it('allows the default number of code lines anywhere in src, and reports one more', async () => {
    const path = 'src/modules/shop/domain/models/big.ts';

    expect(await messagesOf(path, lines(FILE_SIZE.default))).not.toMatch(/max-lines/);
    expect(await messagesOf(path, lines(FILE_SIZE.default + 1))).toMatch(/\[max-lines\]/);
  });

  it('holds application and component code to the lower limit', async () => {
    for (const path of [
      'src/modules/shop/application/services/big.ts',
      'src/modules/shop/presentation/components/big.ts',
      'src/components/shared/big.ts',
    ]) {
      expect(await messagesOf(path, lines(FILE_SIZE.focused))).not.toMatch(/max-lines/);
      expect(await messagesOf(path, lines(FILE_SIZE.focused + 1))).toMatch(/\[max-lines\]/);
    }
  });

  it('does not count blank lines or comments, so documenting a file costs no room', async () => {
    const padded = lines(FILE_SIZE.focused)
      .split('\n')
      .flatMap((line) => ['// why this exists', '', line])
      .join('\n');

    expect(await messagesOf('src/modules/shop/application/services/big.ts', padded)).not.toMatch(
      /max-lines/,
    );
  });

  it('lets a file say that splitting it would hurt', async () => {
    const source = `/* eslint-disable max-lines -- a flat table of codes; splitting it would scatter one list */\n${lines(FILE_SIZE.default + 50)}\n/* eslint-enable max-lines */`;

    expect(await messagesOf('src/modules/shop/domain/models/table.ts', source)).not.toMatch(
      /max-lines/,
    );
  });
});

describe('what the shared library already does', () => {
  const MODULE_FILE = 'src/modules/shop/application/services/group.ts';

  it('rejects a local copy of any @lib/utils helper, read from the library itself', async () => {
    const text = await messagesOf(
      MODULE_FILE,
      'export function groupBy() { return 1; }\nexport const unique = () => 2;\nexport const clamp = function () { return 3; };\nexport function slugify() { return 4; }\n',
    );

    expect(text.match(/@lib\/utils already has this/g)).toHaveLength(4);
  });

  it('points a null filter at isDefined, but leaves a filter on a property alone', async () => {
    const text = await messagesOf(
      MODULE_FILE,
      "export const a = [1, null].filter((x) => x !== null);\nexport const b = [1, undefined].filter((x) => x !== undefined);\nexport const c = [{ v: null }].filter((x) => x.v !== null);\nexport const d = ['', 'a'].filter((x) => x !== '');\nexport const e = [1, 2].filter((x) => x !== 1);\n",
    );

    expect(text.match(/Use \.filter\(isDefined\)/g)).toHaveLength(2);
  });

  it('recognises the hand-written form of a helper by its shape', async () => {
    const text = await messagesOf(
      MODULE_FILE,
      [
        'export const a = [...new Set([1, 2, 1])];',
        'export const b = Array.from(new Set([1, 2]));',
        'export const c = Math.min(10, Math.max(0, 5));',
        'export const d = Math.max(0, Math.min(10, 5));',
        "export const e = (s: string) => s.trim() === '';",
        'export const f = (page: number, pageSize: number) => (page - 1) * pageSize;',
        'export const g = (total: number, pageSize: number) => Math.ceil(total / pageSize);',
      ].join('\n'),
    );

    expect(text.match(/Use unique\(\)/g)).toHaveLength(2);
    expect(text.match(/Use clamp\(\)/g)).toHaveLength(2);
    expect(text).toMatch(/Use isBlank\(\)/);
    expect(text).toMatch(/Use offsetOf\(\) from @lib\/pagination/);
    expect(text).toMatch(/Use pageCountOf\(\) from @lib\/pagination/);
  });

  it('recognises list edits, key picking, query strings and time constants', async () => {
    const text = await messagesOf(
      MODULE_FILE,
      [
        'export const a = <T,>(items: T[], index: number) => items.filter((_, at) => at !== index);',
        'export const b = <T,>(items: T[], index: number, v: T) => items.map((x, at) => (at === index ? v : x));',
        'export const c = (o: Record<string, number | undefined>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));',
        'export const d = (page: number) => new URLSearchParams({ page: String(page) }).toString();',
        'const MS_PER_DAY = 86_400_000;',
        'export const e = MS_PER_DAY * 2;',
        'export const f = 60_000;',
      ].join('\n'),
    );

    expect(text).toMatch(/Use removeAt\(items, index\)/);
    expect(text).toMatch(/Use replaceAt\(items, index, value\)/);
    expect(text).toMatch(/Use pick\(\), omit\(\) or definedKeys\(\)/);
    expect(text).toMatch(/Use buildQueryString\(params\)/);
    expect(text.match(/@lib\/utils already has this/g)).toHaveLength(1);
    expect(text.match(/MS_PER_MINUTE, MS_PER_DAY/g)).toHaveLength(2);
  });

  it('does not mistake a change computed from the old item for a replacement', async () => {
    const text = await messagesOf(
      MODULE_FILE,
      [
        'export const a = <T,>(items: T[], index: number, change: (x: T) => T) => items.map((x, at) => (at === index ? change(x) : x));',
        'export const b = (items: string[], index: number) => items.map((x, at) => (at === index ? null : x));',
      ].join('\n'),
    );

    expect(text).not.toMatch(/replaceAt/);
  });

  it('leaves similar but different code alone', async () => {
    const text = await messagesOf(
      MODULE_FILE,
      [
        'export const a = new Set([1, 2]);',
        'export const b = Math.max(1, 2);',
        "export const c = (s: string) => s.trim() === 'x';",
        'export const d = (page: number, size: number) => page * size;',
      ].join('\n'),
    );

    expect(text).not.toMatch(/Use (unique|clamp|isBlank|offsetOf|pageCountOf)/);
  });

  it('lets @lib/utils itself define them', async () => {
    const out = await lintFiles({
      'src/lib/utils/array.ts': 'export function groupBy() { return 1; }\n',
    });

    expect(out['src/lib/utils/array.ts']!.join('\n')).not.toMatch(/already has this/);
  });
});

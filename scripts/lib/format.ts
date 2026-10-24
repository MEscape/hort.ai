import path from 'node:path';

import { format, resolveConfig } from 'prettier';

/**
 * Import groups, in the order `import/order` requires (eslint/imports.mjs):
 * external (`next/**` first), the `@…` aliases in pathGroups order, parent,
 * sibling, then every remaining type-only import.
 */
const ALIAS_ORDER = ['@modules/', '@components/', '@hooks/', '@i18n', '@lib/', '@types/', '@/'];

interface ImportStatement {
  readonly text: string;
  readonly path: string;
  readonly typeOnly: boolean;
}

function groupRank(statement: ImportStatement): number {
  const spec = statement.path;
  const alias = ALIAS_ORDER.findIndex((prefix) => spec === prefix || spec.startsWith(prefix));
  if (alias !== -1) {
    return 10 + alias;
  }
  if (statement.typeOnly) {
    return 100;
  }
  if (spec.startsWith('next')) {
    return 0;
  }
  if (spec.startsWith('../')) {
    return 30;
  }
  if (spec.startsWith('./')) {
    return 31;
  }
  return 1; // external package
}

/** `import/order` compares paths segment by segment, so `./x` sorts before `../x`. */
function comparePaths(a: string, b: string): number {
  const left = a.toLowerCase().split('/');
  const right = b.toLowerCase().split('/');
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const l = left[index] ?? '';
    const r = right[index] ?? '';
    if (l !== r) {
      return l < r ? -1 : 1;
    }
  }
  return left.length - right.length;
}

const IMPORT_AT_START = /^import (type )?(?:[^;'"]*? from )?(['"])([^'"]+)\2;?[ \t]*(?:\r?\n|$)/;
const SIDE_EFFECT = /^import ['"][^'"]+['"];?/;

/**
 * Orders the leading import block the way the repository's `import/order`
 * configuration expects, so generated files never depend on a template
 * author guessing an order that varies with the generated names.
 * Side-effect imports (`import 'server-only'`) stay first.
 */
export function organizeImports(source: string): string {
  const firstImport = /^import /m.exec(source);
  if (firstImport === null) {
    return source;
  }

  const preamble = source.slice(0, firstImport.index);
  let rest = source.slice(firstImport.index);
  const statements: ImportStatement[] = [];
  const sideEffects: string[] = [];

  for (;;) {
    const trimmed = rest.replace(/^\s+/, '');
    const match = IMPORT_AT_START.exec(trimmed);
    if (match === null) {
      break;
    }
    const text = match[0].trimEnd();
    if (SIDE_EFFECT.test(text)) {
      sideEffects.push(text);
    } else {
      statements.push({ text, path: match[3] ?? '', typeOnly: match[1] !== undefined });
    }
    rest = trimmed.slice(match[0].length);
  }

  const ranked = statements
    .map((statement, index) => ({ statement, index, rank: groupRank(statement) }))
    .sort(
      (a, b) =>
        a.rank - b.rank || comparePaths(a.statement.path, b.statement.path) || a.index - b.index,
    );

  const groups: string[][] = [];
  let currentRank: number | undefined;
  for (const { statement, rank } of ranked) {
    const current = groups[groups.length - 1];
    if (current === undefined || rank !== currentRank) {
      groups.push([statement.text]);
      currentRank = rank;
    } else {
      current.push(statement.text);
    }
  }
  const blocks = groups.map((group) => group.join('\n'));

  const head = sideEffects.length > 0 ? `${sideEffects.join('\n')}\n` : '';
  return `${preamble}${head}${blocks.join('\n\n')}\n\n${rest.replace(/^\s+/, '')}`;
}

/**
 * Formats generated source with the repository's own Prettier config and
 * import order, so templates only have to be correct, not perfectly laid out.
 */
export async function formatSource(root: string, rel: string, content: string): Promise<string> {
  const filepath = path.join(root, rel);
  const config = await resolveConfig(filepath);
  const prepared = /\.tsx?$/.test(rel) ? organizeImports(content) : content;
  return format(prepared, { ...config, filepath });
}

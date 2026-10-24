import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** ESLint and the tests both run from the repository root. */
const UTILS_DIR = join(process.cwd(), 'src', 'lib', 'utils');

/**
 * The helper functions `@lib/utils` exports, read from the source so the list can never lag behind the
 * library: add a helper there and a local copy of it is reported from then on. Constants and types are
 * not helpers; only `export function name` and `export const name = (…) =>` (camelCase) count.
 */
export function utilsHelperNames() {
  const names = new Set();
  for (const file of readdirSync(UTILS_DIR)) {
    if (!file.endsWith('.ts') || file === 'index.ts') continue;
    const text = readFileSync(join(UTILS_DIR, file), 'utf8');
    for (const match of text.matchAll(/^export (?:async )?function ([a-z]\w*)/gm)) {
      names.add(match[1]);
    }
    for (const match of text.matchAll(/^export const ([a-z]\w*) = (?:async )?\(/gm)) {
      names.add(match[1]);
    }
  }
  return [...names].sort();
}

/**
 * The constants `@lib/utils` exports (`MS_PER_DAY`, ...), by the same reading. A local constant with the
 * same name is a copy that can drift.
 */
export function utilsConstantNames() {
  const names = new Set();
  for (const file of readdirSync(UTILS_DIR)) {
    if (!file.endsWith('.ts') || file === 'index.ts') continue;
    const text = readFileSync(join(UTILS_DIR, file), 'utf8');
    for (const match of text.matchAll(/^export const ([A-Z][A-Z0-9_]*)\b/gm)) names.add(match[1]);
  }
  return [...names].sort();
}

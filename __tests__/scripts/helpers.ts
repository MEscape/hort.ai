import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, posix, relative as relativeNative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { afterAll } from 'vitest';

import { architectureRules } from '../../eslint/config/architecture.mjs';
import { imports } from '../../eslint/config/imports.mjs';
import { runAllChecks } from '../../eslint/policy/index.mjs';
import { runModule } from '../../scripts/commands/module';

/** Repository-relative paths use `/` on every platform, like the generators' own. */
function relative(from: string, to: string): string {
  return relativeNative(from, to).replaceAll('\\', '/');
}

/** The real repository. Tests only read it (shape checks) and never write to it. */
export const REAL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Frozen copies of the files a generator reads or edits (see fixtures/README.md), keyed by the
 * repository path they are seeded to. Hermetic on purpose: the real files change whenever
 * someone uses a generator.
 */
const FIXTURES: Record<string, string> = {
  '.prettierrc.json': 'prettierrc.json.txt',
  '.env.example': 'env.example.txt',
  'src/i18n/locales/en.ts': 'locales-en.ts.txt',
  'src/i18n/locales/de.ts': 'locales-de.ts.txt',
  'src/i18n/messages/en.json': 'app-en.json.txt',
  'src/i18n/messages/de.json': 'app-de.json.txt',
};
const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

const created: string[] = [];

afterAll(() => {
  for (const root of created) {
    rmSync(root, { recursive: true, force: true });
  }
});

/** A temporary stand-in repository with the seed files of the real one. */
export function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'gen-test-'));
  created.push(root);
  for (const [path, fixture] of Object.entries(FIXTURES)) {
    const target = join(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(join(FIXTURE_DIR, fixture)));
  }
  mkdirSync(join(root, 'src/modules'), { recursive: true });
  return root;
}

/** A full copy of a prepared tree, so each test can mutate its own. */
export function cloneRepo(source: string): string {
  const root = mkdtempSync(join(tmpdir(), 'gen-test-'));
  created.push(root);
  cpSync(source, root, { recursive: true });
  return root;
}

/** An empty directory outside any repository (a place escapes could land in). */
export function makeOutside(): string {
  const root = mkdtempSync(join(tmpdir(), 'gen-outside-'));
  created.push(root);
  return root;
}

/** A directory link; a junction on Windows, where creating a symlink needs elevated rights. */
export function linkDirectory(target: string, path: string): void {
  symlinkSync(target, path, 'junction');
}

/** Every file under `root` (relative, sorted) with its content. */
export function snapshot(root: string): Record<string, string> {
  const result: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) {
        walk(abs);
      } else {
        result[relative(root, abs)] = readFileSync(abs, 'utf8');
      }
    }
  };
  walk(root);
  return result;
}

/** Paths whose content differs between two snapshots, including added and removed ones. */
export function changedPaths(
  before: Record<string, string>,
  after: Record<string, string>,
): string[] {
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...paths].filter((path) => before[path] !== after[path]).sort();
}

export const FIELDS =
  'name:string,note:string?,quantity:number,amountCents:money,status:enum(draft|sent|paid),dueAt:date?,active:boolean';

/** Generates the reference module (`inventory`, entity `item`) into `root`. */
export async function generateReference(root: string, extra: string[] = []): Promise<string> {
  return runModule(
    ['inventory', '--entity', 'item', '--fields', FIELDS, '--unique', 'name', ...extra],
    { root },
  );
}

/** Whole-tree architecture violations, formatted for a readable failure message. */
export function policyViolations(root: string): string[] {
  return runAllChecks(root).map(
    (v: { group?: string; check?: string; file?: string; message: string }) =>
      `[${v.group ?? v.check ?? '?'}] ${v.file ?? ''}: ${v.message}`,
  );
}

/** Lints a tree with only the repository's architecture rule blocks (as `new-module.test.ts` does). */
export async function lintTree(root: string): Promise<string[]> {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
      },
      ...architectureRules,
    ],
  });
  const results = await eslint.lintFiles(['src/**/*.{ts,tsx}']);
  return results.flatMap((r) =>
    r.messages.map((m) => `${relative(root, r.filePath)}:${m.line} [${m.ruleId}] ${m.message}`),
  );
}

/** Replaces text in a file of a tree and fails loudly if nothing changed. */
export function replaceInFile(root: string, path: string, from: string, to: string): void {
  const abs = join(root, path);
  const before = readFileSync(abs, 'utf8');
  const after = before.replace(from, to);
  if (after === before) {
    throw new Error(`replacement did not change ${path}`);
  }
  writeFileSync(abs, after);
}

const IMPORT_RULES = new Set([
  'import/order',
  'import/no-duplicates',
  'unused-imports/no-unused-imports',
]);

/** Import hygiene findings from the repository's own `import/*` configuration. */
export async function lintImports(root: string, patterns: string[]): Promise<string[]> {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
      },
      ...imports,
    ],
  });
  const results = await eslint.lintFiles(patterns);
  return results.flatMap((r) =>
    r.messages
      .filter((m) => m.ruleId !== null && IMPORT_RULES.has(m.ruleId))
      .map((m) => `${relative(root, r.filePath)}:${m.line} [${m.ruleId}] ${m.message}`),
  );
}

/** Import findings for a source text, as if it lived at `filePath` inside `root`. */
export async function lintImportsOfText(
  root: string,
  filePath: string,
  code: string,
): Promise<string[]> {
  const abs = join(root, filePath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, code);
  return lintImports(root, [filePath]);
}

/**
 * The repository's size limits (`eslint/config/style.mjs`), which generated code must respect for any
 * number of fields: a branch per field would eventually exceed them.
 */
export async function lintLimits(root: string): Promise<string[]> {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.{ts,tsx}'],
        languageOptions: { parser: tseslint.parser },
        rules: { complexity: ['error', 12], 'max-params': ['error', 3] },
      },
    ],
  });
  const results = await eslint.lintFiles(['src/**/*.{ts,tsx}']);
  return results.flatMap((r) =>
    r.messages.map((m) => `${relative(root, r.filePath)}:${m.line} [${m.ruleId}] ${m.message}`),
  );
}

/** Relative and `@modules/...` import specifiers of a TypeScript source. */
export function localImports(source: string): string[] {
  return [...source.matchAll(/from '((?:\.{1,2}\/|@modules\/)[^']*)'/g)].flatMap((m) => m[1] ?? []);
}

/** Resolves an import of `fromFile` to a key of `files`, or `undefined` if nothing matches. */
export function resolveImport(
  files: Record<string, string>,
  fromFile: string,
  specifier: string,
): string | undefined {
  const base = specifier.startsWith('@modules/')
    ? `src/modules/${specifier.slice('@modules/'.length)}`
    : posix.join(posix.dirname(fromFile), specifier);
  return [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, `${base}/index.ts`].find(
    (candidate) => candidate in files,
  );
}

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

import { afterAll } from 'vitest';

const created: string[] = [];

/** Writes a file map into a fresh temp tree (a stand-in repository root) and returns its path. */
export function makeTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'arch-fixture-'));
  created.push(root);
  for (const [path, content] of Object.entries(files)) {
    const abs = join(root, path);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

/** A path inside the fixture root with `/` separators, whatever the platform. */
export function relativeToRoot(filePath: string, root: string): string {
  return relative(root, filePath).replaceAll('\\', '/');
}

afterAll(() => {
  for (const root of created) {
    rmSync(root, { recursive: true, force: true });
  }
});

export interface Violation {
  readonly check: string;
  readonly file?: string;
  readonly message: string;
  readonly group?: string;
}

export function describeViolations(violations: readonly Violation[]): string {
  return violations
    .map((v) => `[${v.group ?? v.check}] ${v.file ?? ''}\n    ${v.message}`)
    .join('\n');
}

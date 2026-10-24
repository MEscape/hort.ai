#!/usr/bin/env tsx
import { describeFinding, findUnusedExports } from './lib/dead-code';

import type { ExportFinding, ExportUse } from './lib/dead-code';

const USAGE = `Finds exports nothing uses.

  npm run dead-code                 fail when an export is used by nothing at all
  npm run dead-code -- --all        also list exports only tests use, and exports used only in their own file
  npm run dead-code -- --scope=src/modules/profile   judge one folder (every file still counts as a user)

An export that something the compiler cannot see needs (a string lookup, a framework convention) says so:
  /** @keep <reason> */`;

const TITLES: Record<ExportUse, string> = {
  dead: 'Used by nothing (delete it, or say why it stays with /** @keep <reason> */)',
  'test-only': 'Used only by tests (a helper waiting for its caller, or code only tests need)',
  'unneeded-export': 'Used only in its own file (drop the `export`)',
};

function print(use: ExportUse, findings: readonly ExportFinding[]): void {
  const own = findings.filter((finding) => finding.use === use);
  if (own.length === 0) {
    return;
  }
  process.stdout.write(`\n${TITLES[use]}: ${own.length}\n`);
  for (const finding of own) {
    process.stdout.write(`  ${describeFinding(finding)}\n`);
  }
}

function main(argv: readonly string[]): number {
  if (argv.includes('--help')) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const scope = argv.find((arg) => arg.startsWith('--scope='))?.slice('--scope='.length);
  const showAll = argv.includes('--all');
  const started = Date.now();
  const findings = findUnusedExports({
    root: process.cwd(),
    ...(scope === undefined ? {} : { scope }),
  });

  print('dead', findings);
  if (showAll) {
    print('test-only', findings);
    print('unneeded-export', findings);
  }
  const count = (use: ExportUse) => findings.filter((finding) => finding.use === use).length;
  process.stdout.write(
    `\ndead code: ${count('dead')} unused, ${count('test-only')} test-only, ${count('unneeded-export')} unneeded export(s) in ${((Date.now() - started) / 1000).toFixed(1)}s` +
      `${showAll ? '' : ' (--all lists the last two)'}\n`,
  );
  return count('dead') === 0 ? 0 : 1;
}

process.exitCode = main(process.argv.slice(2));

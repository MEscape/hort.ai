#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process';

import { evaluateAudit } from './lib/security-audit';

import type { AuditException } from './lib/security-audit';

/**
 * Reviewed, time-boxed exceptions. Each entry needs a decision and an end date; after that date the
 * audit fails until the entry is removed or a new review extends it.
 */
const EXCEPTIONS: readonly AuditException[] = [
  {
    advisory: 'GHSA-86w9-cpqp-85rv',
    until: '2027-01-24',
    reason:
      'node-forge via ask-sdk-express-adapter, no patched release; see alexa/README.md (decision B S, 2026-10-24)',
  },
];

function main(): number {
  const audit = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  let report: unknown;
  try {
    report = JSON.parse(audit.stdout);
  } catch {
    report = undefined;
  }
  const today = new Date().toISOString().slice(0, 10);
  const verdict = evaluateAudit(report, EXCEPTIONS, today);
  for (const note of verdict.notes) {
    process.stdout.write(`security audit: ${note}\n`);
  }
  for (const failure of verdict.failures) {
    process.stderr.write(`security audit FAILED: ${failure}\n`);
  }
  if (verdict.ok) {
    process.stdout.write('security audit: no unreviewed high or critical production advisory\n');
  }
  return verdict.ok ? 0 : 1;
}

process.exitCode = main();

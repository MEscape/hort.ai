#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process';

import { evaluateAudit, type AdvisoryException } from './lib/audit-gate';

/**
 * Reviewed exceptions. Keep each one narrow and dated; the gate fails again the day after `expires`.
 * GHSA-86w9-cpqp-85rv: see alexa/README.md, "Known security exception" (decision B S, 2026-10-24).
 */
const EXCEPTIONS: readonly AdvisoryException[] = [
  {
    ghsa: 'GHSA-86w9-cpqp-85rv',
    expires: '2027-01-24',
    reason:
      'node-forge (no fix) via the official ASK SDK verifier; only checks the chain of the pinned Amazon cert',
  },
];

const audit = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});

try {
  const findings = evaluateAudit(JSON.parse(audit.stdout || 'null'), EXCEPTIONS, new Date());
  for (const f of findings) {
    process.stdout.write(
      `${f.allowed ? 'allowed ' : 'BLOCKING'} ${f.severity} ${f.packageName} ${f.ghsa}\n`,
    );
  }
  const blocking = findings.filter((finding) => !finding.allowed);
  process.stdout.write(
    `audit: ${blocking.length} blocking high/critical advisory(ies) in production deps\n`,
  );
  process.exitCode = blocking.length > 0 ? 1 : 0;
} catch (error) {
  process.stderr.write(`audit failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.stderr.write(audit.stderr);
  process.exitCode = 1;
}

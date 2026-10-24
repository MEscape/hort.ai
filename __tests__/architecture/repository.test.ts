import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { describeEntryPoints } from '../../eslint/policy/checks-behavior.mjs';
import { describeRateLimitOptOuts } from '../../eslint/policy/checks-rate-limits.mjs';
import { CHECKS, loadProject } from '../../eslint/policy/index.mjs';
import { KNOWN_MODULE_CYCLES } from '../../eslint/policy/policy.mjs';

import { describeViolations } from './fixture-tree';

import type { Violation } from './fixture-tree';

const ROOT = process.cwd();
const project = loadProject(ROOT);
const hasModules = project.modules.length > 0;
const modulesDir = join(ROOT, 'src/modules');

describe('architecture of this repository', () => {
  it('finds the modules it is meant to police', () => {
    // `src/modules` is created with the first module, so its absence is an empty list.
    const fsModules = existsSync(modulesDir)
      ? readdirSync(modulesDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
          .sort()
      : [];
    expect(project.modules).toEqual(fsModules);
    expect(project.files.size).toBeGreaterThan(0);
  });

  for (const [name, check] of Object.entries<(p: unknown) => Violation[]>(CHECKS)) {
    it(`holds: ${name}`, () => {
      const violations = check(project);
      expect(violations, `\n${describeViolations(violations)}\n`).toEqual([]);
    });
  }

  it.skipIf(!hasModules)(
    'gives every externally reachable entry point an explicit authorization category',
    () => {
      const entries = describeEntryPoints(project) as Array<{
        kind: string;
        name: string;
        category: string;
        ok: boolean;
        reason?: string | null;
      }>;
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.filter((e) => !e.ok).map((e) => `${e.kind}:${e.name}=${e.category}`)).toEqual(
        [],
      );

      // Every non-protected entry point must have a stated reason >= 20 characters
      const nonProtectedWithoutReason = entries.filter(
        (e) =>
          e.category !== 'protected' &&
          (e.kind === 'use-case' || e.kind === 'route-handler') &&
          (!e.reason || e.reason.trim().length < 20),
      );
      expect(
        nonProtectedWithoutReason.map((e) => `${e.kind}:${e.name} reason="${e.reason ?? ''}"`),
        'Every public/system use-case and non-protected route-handler must carry a reason >= 20 chars',
      ).toEqual([]);
    },
  );

  it('ensures every rate-limit opt-out has a stated reason', () => {
    const optOuts = describeRateLimitOptOuts(project);
    for (const optOut of optOuts) {
      expect(
        optOut.reason.length,
        `${optOut.module}:${optOut.name} needs a reason of >= 20 chars`,
      ).toBeGreaterThanOrEqual(20);
    }
  });

  it('lists a known module cycle only while it exists', () => {
    // `holds: module graph` already fails for an unlisted cycle and for a listed one that is gone; this pins the list.
    expect(KNOWN_MODULE_CYCLES).toEqual([]);
  });
});

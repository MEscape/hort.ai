import { describe, expect, it } from 'vitest';

import { policyProblem } from '@lib/rate-limit/rate-limit-policy';
import type { RateLimitPolicy } from '@lib/rate-limit/rate-limit-policy';

import { describeRateLimitPolicies } from '../../eslint/policy/checks-rate-limits.mjs';
import { loadProject } from '../../eslint/policy/index.mjs';

/**
 * Every module declares its rate-limit policies as plain data in `application/rate-limits.ts`.
 * `eslint/policy/checks-rate-limits.mjs` (run with the other whole-tree checks in
 * `repository.test.ts`) reads them as syntax: namespaced, unique, explicit about how they fail,
 * spent by a use case. This test imports them as the limiter does, so what only values can show
 * holds too: every policy is valid, and any fail-open policy carries a reviewed in-code reason.
 */
const project = loadProject(process.cwd());
const declared = describeRateLimitPolicies(project) as Array<{
  readonly module: string;
  readonly exportName: string;
  readonly key: string;
  readonly id: string;
  readonly onBackendFailure: string;
  readonly failOpenReason: string | null;
}>;

const policyFiles = import.meta.glob<Record<string, Record<string, RateLimitPolicy>>>(
  '/src/modules/*/application/rate-limits.ts',
  { eager: true },
);

const imported = Object.entries(policyFiles).flatMap(([file, exports]) => {
  const moduleName = /\/src\/modules\/([^/]+)\//.exec(file)?.[1] ?? '';
  return Object.values(exports).flatMap((group) =>
    Object.values(group).map((policy) => ({ moduleName, policy })),
  );
});

describe('rate-limit policies across modules', () => {
  it('finds the policies of every module that limits something (the glob matched something real)', () => {
    const declaredModules = [...new Set(declared.map((entry) => entry.module))].sort();
    const globModules = [
      ...new Set(
        Object.keys(policyFiles)
          .map((file) => /\/src\/modules\/([^/]+)\//.exec(file)?.[1] ?? '')
          .filter(Boolean),
      ),
    ].sort();

    expect(declaredModules).toEqual(globModules);
  });

  it('reads the same policies from the syntax and from the values', () => {
    expect(imported.map(({ policy }) => policy.id).sort()).toEqual(
      declared.map((entry) => entry.id).sort(),
    );
  });

  it('declares only valid policies (id, limit, window, explicit failure mode)', () => {
    const problems = imported
      .map(({ moduleName, policy }) => ({
        moduleName,
        id: policy.id,
        problem: policyProblem(policy),
      }))
      .filter((entry) => entry.problem !== null);

    expect(problems).toEqual([]);
  });

  it('requires every fail-open policy to declare an in-code reason', () => {
    const failOpen = declared.filter((entry) => entry.onBackendFailure === 'allow');
    for (const entry of failOpen) {
      expect(
        entry.failOpenReason,
        `Policy ${entry.module}:${entry.key} (${entry.id}) fails open and must have a stated @fail-open reason`,
      ).toBeTruthy();
      expect(
        entry.failOpenReason?.length,
        `Policy ${entry.module}:${entry.key} fail-open reason must be at least 20 characters`,
      ).toBeGreaterThanOrEqual(20);
    }
  });
});

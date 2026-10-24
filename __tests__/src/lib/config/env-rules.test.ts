import { describe, expect, it } from 'vitest';

import { envRuleIssues, refineEnv } from '@lib/config/env-rules';
import type { EnvRule } from '@lib/config/env-rules';

interface Env {
  readonly a: number;
  readonly b: number;
}

const rules: ReadonlyArray<EnvRule<Env>> = [
  { path: 'a', violated: (env) => env.a < 1, message: 'a is too small.' },
  { path: 'b', violated: (env) => env.b < 1, message: (env) => `b is ${env.b}, too small.` },
];

describe('envRuleIssues', () => {
  it('reports nothing when no rule is violated', () => {
    expect(envRuleIssues({ a: 1, b: 1 }, rules)).toEqual([]);
  });

  it('reports violated rules in listed order, resolving message functions', () => {
    expect(envRuleIssues({ a: 0, b: 0 }, rules)).toEqual([
      { path: 'a', message: 'a is too small.' },
      { path: 'b', message: 'b is 0, too small.' },
    ]);
  });
});

describe('refineEnv', () => {
  it('adds one custom issue per violation across every rule set', () => {
    const added: Array<{ code: 'custom'; path: string[]; message: string }> = [];
    const other: ReadonlyArray<EnvRule<Env>> = [
      { path: 'a', violated: () => true, message: 'always.' },
    ];

    refineEnv(rules, other)({ a: 0, b: 5 }, { addIssue: (issue) => added.push(issue) });

    expect(added).toEqual([
      { code: 'custom', path: ['a'], message: 'a is too small.' },
      { code: 'custom', path: ['a'], message: 'always.' },
    ]);
  });
});

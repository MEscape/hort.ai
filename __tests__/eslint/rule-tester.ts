import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { afterAll, describe, it } from 'vitest';

import plugin from '../../eslint/plugins/architecture/index.mjs';

import type { Rule } from 'eslint';

// ESLint reads these statics to run inside any test framework; its typings do not declare them.
Object.assign(RuleTester, { afterAll, describe, it, itOnly: it.only });

export const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
    sourceType: 'module',
  },
});

export const rules = plugin.rules as Record<string, Rule.RuleModule>;

/** An invalid case whose single message must match `pattern` (one entry per expected report). */
export function invalid(filename: string, code: string, ...patterns: RegExp[]) {
  return { filename, code, errors: patterns.map((message) => ({ message })) };
}

export function valid(filename: string, code: string) {
  return { filename, code };
}

/**
 * Lints a fixture tree with the repository's real config blocks (restrictions, style, react, overrides)
 * and returns the messages per file, as `[rule] message`.
 */
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';

import { overrides } from '../../eslint/config/overrides.mjs';
import { react } from '../../eslint/config/react.mjs';
import { restrictions } from '../../eslint/config/restrictions.mjs';
import { afterPrettier, style } from '../../eslint/config/style.mjs';
import { makeTree, relativeToRoot } from '../architecture/fixture-tree';

export async function lintFiles(files: Record<string, string>): Promise<Record<string, string[]>> {
  const root = makeTree(files);
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
      ...restrictions,
      ...style,
      ...react,
      ...overrides,
      ...afterPrettier,
    ],
  });
  const results = await eslint.lintFiles(['src/**/*.{ts,tsx}']);
  return Object.fromEntries(
    results.map((r) => [
      relativeToRoot(r.filePath, root),
      r.messages.map((m) => `[${m.ruleId}] ${m.message}`),
    ]),
  );
}

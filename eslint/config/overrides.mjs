import { CONFIG_FILES, FRAMEWORK_FILES, TEST_FILES } from './globs.mjs';
import { FOCUSED_TESTS } from './selectors.mjs';

/** Narrow, documented relaxations for tests, framework entry points and config/tooling files. */
export const overrides = [
  // The logger's transport is the only legitimate console.* site; everything else uses the logger.
  { files: ['src/lib/logger/logger.ts'], rules: { 'no-console': 'off' } },

  // Framework-reserved files require default exports.
  { files: FRAMEWORK_FILES, rules: { 'import/no-default-export': 'off' } },

  // Tests: relax rules that do not make sense for test code. __tests__/ mirrors src/.
  {
    files: TEST_FILES,
    rules: {
      'no-magic-numbers': 'off',
      // Fixtures render literal text on purpose.
      'react/jsx-no-literals': 'off',
      'max-params': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      // Tests import the ESM tooling by explicit file name (index.mjs); a directory import would not resolve.
      'import/no-useless-path-segments': 'off',
      // Fixture builders mutate plain file maps on purpose.
      'no-param-reassign': 'off',
      '@typescript-eslint/no-dynamic-delete': 'off',
      'no-console': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'import/no-extraneous-dependencies': 'off',
      // Tests may use process.env, Date and so on, but a committed `.only` silently skips the rest of the suite.
      'no-restricted-syntax': ['error', ...FOCUSED_TESTS],
      'no-restricted-imports': 'off',
    },
  },

  // Config and tooling: default exports and Node globals are legitimate. Several plugins
  // publish `.configs` without types, so spreading `plugin.configs.x.rules` is `any`;
  // the unsafe-* family is disabled for these files only, never project-wide.
  {
    files: CONFIG_FILES,
    rules: {
      'import/no-default-export': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-deprecated': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'import/no-extraneous-dependencies': 'off',
      'import/no-useless-path-segments': 'off', // ESM needs explicit file paths (index.mjs)
      'no-restricted-syntax': 'off',
      'no-magic-numbers': 'off',
      complexity: 'off',
      'max-params': 'off',
    },
    languageOptions: {
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        console: 'readonly',
      },
    },
  },
];

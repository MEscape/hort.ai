import eslintComments from 'eslint-plugin-eslint-comments';
import sonarjs from 'eslint-plugin-sonarjs';

import { FILE_SIZE, FOCUSED_SIZE_GLOBS } from '../policy/policy.mjs';

/** Code lines only: blank lines and comments do not count, so documenting a file never costs room. */
const codeLines = (max) => ['error', { max, skipBlankLines: true, skipComments: true }];

/** Built-in ESLint correctness and code-style rules, comment hygiene and smell detection. */
export const style = [
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // correctness (several come from js.configs.recommended; listed so the intent is explicit)
      eqeqeq: ['error', 'always'],
      'no-debugger': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-unsafe-optional-chaining': 'error',
      'no-constant-condition': 'error',
      'no-unreachable': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': ['error', 'always'],
      'no-param-reassign': ['error', { props: true }],
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'no-else-return': ['error', { allowElseIf: false }],
      'no-nested-ternary': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-magic-numbers': [
        'warn',
        {
          ignore: [-1, 0, 1, 2],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          enforceConst: true,
          detectObjects: false,
        },
      ],
      complexity: ['warn', 12],
      'max-params': ['warn', 3],
    },
  },
  // docs/rules/code-style.md: small files. Application and component code is held to the lower limit.
  { files: ['src/**/*.{ts,tsx}'], rules: { 'max-lines': codeLines(FILE_SIZE.default) } },
  { files: FOCUSED_SIZE_GLOBS, rules: { 'max-lines': codeLines(FILE_SIZE.focused) } },
  // Redux Toolkit slices mutate state through Immer.
  {
    files: [
      'src/**/store/**/*-slice.ts',
      'src/**/store/**/*-reducer.ts',
      'src/**/store/**/*-thunks.ts',
    ],
    rules: { 'no-param-reassign': 'off' },
  },
  // Pure math/date helpers read better with literals.
  {
    files: ['src/lib/utils/**/*.{ts,tsx}', 'src/lib/config/**/*.{ts,tsx}'],
    rules: { 'no-magic-numbers': 'off', 'max-params': 'off' },
  },
  {
    plugins: { 'eslint-comments': eslintComments },
    rules: {
      'eslint-comments/require-description': ['error', { ignore: [] }],
      'eslint-comments/no-unused-disable': 'error',
      'eslint-comments/disable-enable-pair': ['error', { allowWholeFile: false }],
    },
  },
  {
    plugins: { sonarjs },
    rules: {
      'sonarjs/no-duplicate-string': ['warn', { threshold: 5 }],
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/cognitive-complexity': ['warn', 15],
      'sonarjs/no-small-switch': 'warn',
    },
  },
];

/**
 * Must come AFTER eslint-config-prettier, which switches `curly` off because
 * some option values conflict with Prettier. `all` does not conflict.
 */
export const afterPrettier = [
  {
    files: ['**/*.{ts,tsx}'],
    rules: { curly: ['error', 'all'] },
  },
];

import importPlugin from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';

import { CONFIG_FILES, TEST_FILES } from './globs.mjs';

/**
 * Import hygiene: order, duplicates, cycles, resolution. One tool
 * (eslint-plugin-import) covers all of it, so ESLint core's
 * `no-duplicate-imports` is intentionally NOT enabled: it would report the
 * same statements twice and cannot tell `import type` from a value import
 * under `fixStyle: 'separate-type-imports'`.
 * Aliases stay in sync with tsconfig.json `paths`.
 */
export const imports = [
  {
    plugins: { import: importPlugin, 'unused-imports': unusedImports },
    rules: {
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
          pathGroups: [
            { pattern: 'react', group: 'external', position: 'before' },
            { pattern: 'react-dom', group: 'external', position: 'before' },
            { pattern: 'next', group: 'external', position: 'before' },
            { pattern: 'next/**', group: 'external', position: 'before' },
            { pattern: '@modules/**', group: 'internal', position: 'after' },
            { pattern: '@components/**', group: 'internal', position: 'after' },
            { pattern: '@hooks/**', group: 'internal', position: 'after' },
            { pattern: '@i18n', group: 'internal', position: 'after' },
            { pattern: '@i18n/**', group: 'internal', position: 'after' },
            { pattern: '@lib/**', group: 'internal', position: 'after' },
            { pattern: '@types/**', group: 'internal', position: 'after' },
            { pattern: '@/**', group: 'internal', position: 'after' },
          ],
          pathGroupsExcludedImportTypes: ['react', 'react-dom', 'next'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-cycle': ['error', { maxDepth: Infinity, ignoreExternal: true }],
      'import/no-self-import': 'error',
      'import/no-useless-path-segments': ['error', { noUselessIndex: true }],
      'import/no-duplicates': 'error',
      'import/no-default-export': 'error',
      'import/no-unresolved': 'off', // TypeScript resolves modules
      'import/no-extraneous-dependencies': [
        'error',
        { devDependencies: [...TEST_FILES, ...CONFIG_FILES], optionalDependencies: false },
      ],
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' },
      ],
    },
  },
];

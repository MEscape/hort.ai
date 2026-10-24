import js from '@eslint/js';
import { globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

import { GENERATED_FILES } from './globs.mjs';

/** Ignores, ESLint core recommended set, and the type-aware TypeScript presets. */
export const base = [
  globalIgnores([
    '**/.next/**',
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/.turbo/**',
    '**/.vercel/**',
    '**/next-env.d.ts',
    '**/*.min.js',
    '**/generated/**',
    '**/.contentlayer/**',
    'prisma/migrations/**',
    '**/temp/**',
    '**/.tmp-*/**',
    ...GENERATED_FILES,
  ]),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname + '/../..',
      },
    },
    settings: {
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: './tsconfig.json' },
        node: true,
      },
    },
  },

  // Plain JavaScript (config, tooling, the architecture plugin) is outside the TS project:
  // lint it without type information instead of listing every file in allowDefaultProject.
  {
    ...tseslint.configs.disableTypeChecked,
    files: ['**/*.{js,mjs,cjs}'],
  },
];

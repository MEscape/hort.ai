/** TypeScript ESLint rules layered on strictTypeChecked + stylisticTypeChecked. */
export const typescript = [
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // --- type safety ---------------------------------------------------
      // `unknown` at untrusted boundaries; `any` never. Justified assertions stay legal,
      // but an assertion that changes nothing is reported.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',

      // --- async correctness --------------------------------------------
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/await-thenable': 'error',

      // --- exhaustiveness -------------------------------------------------
      // A `default` branch counts as handling the remaining members of a union, so a
      // deliberate fallback is not noise; adding a member to a union without a default still fails.
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true },
      ],

      // --- modules ----------------------------------------------------------
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-require-imports': 'error',

      // --- style that carries meaning ----------------------------------------
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off', // enforced for module index.ts below

      // Delegated to `unused-imports/no-unused-vars` (same rule, same options, plus auto-removal
      // of unused imports); tsconfig also sets noUnusedLocals/noUnusedParameters.
      '@typescript-eslint/no-unused-vars': 'off',

      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: { regex: '^I[A-Z]', match: false },
        },
        { selector: 'typeAlias', format: ['PascalCase'], custom: { regex: 'Type$', match: false } },
        { selector: 'typeLike', format: ['PascalCase'] },
        {
          selector: 'variable',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'variable', filter: { regex: 'Schema$', match: true }, format: ['camelCase'] },
        {
          selector: 'function',
          filter: { regex: '^use[A-Z]', match: true },
          format: ['camelCase'],
        },
      ],
    },
  },
  // The module's public surface is explicitly typed.
  {
    files: ['src/modules/*/index.ts'],
    rules: { '@typescript-eslint/explicit-module-boundary-types': 'error' },
  },
];

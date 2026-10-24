import checkFile from 'eslint-plugin-check-file';

/** kebab-case files and folders, with Next.js-reserved names exempt. check-file lacks full RuleType typings. */
export const naming = [
  {
    files: ['**/*.{ts,tsx}'],
    ignores: [
      '**/page.tsx',
      '**/layout.tsx',
      '**/loading.tsx',
      '**/error.tsx',
      '**/not-found.tsx',
      '**/route.ts',
      '**/proxy.ts',
      '**/middleware.ts',
      '**/instrumentation.ts',
      '**/default.tsx',
      '**/template.tsx',
      '**/opengraph-image.tsx',
      '**/twitter-image.tsx',
      '**/icon.tsx',
      '**/sitemap.ts',
      '**/robots.ts',
      '**/manifest.ts',
      '**/index.ts',
      '**/*.d.ts',
    ],
    plugins: { 'check-file': /** @type {any} */ (checkFile) },
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.{ts,tsx}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
    },
  },
  {
    files: ['**/*'],
    plugins: { 'check-file': /** @type {any} */ (checkFile) },
    rules: {
      'check-file/folder-naming-convention': [
        'error',
        {
          'src/modules/**/': 'KEBAB_CASE',
          'src/components/**/': 'KEBAB_CASE',
          'src/lib/**/': 'KEBAB_CASE',
          'src/hooks/**/': 'KEBAB_CASE',
          'src/store/**/': 'KEBAB_CASE',
        },
      ],
    },
  },
];

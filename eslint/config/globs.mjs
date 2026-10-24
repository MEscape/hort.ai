/** Globs and constants shared by the config modules. */

/** Tests live in __tests__/** (mirroring src/) and may be co-located. */
export const TEST_FILES = [
  '__tests__/**/*.{ts,tsx}',
  'src/**/*.test.{ts,tsx}',
  'src/**/*.spec.{ts,tsx}',
];

/** Config, tooling and script files: Node globals, relaxed rules. */
export const CONFIG_FILES = [
  '*.config.{js,ts,mjs,cjs}',
  'eslint/**/*.{mjs,ts}',
  'prisma/seed.ts',
  'prisma/config.ts',
  'scripts/**/*.{ts,js}',
  'middleware.ts',
  'instrumentation.ts',
  'vitest.setup.ts',
  'vitest.config.ts',
];

/** Next.js reserved files that require default exports. */
export const FRAMEWORK_FILES = [
  'src/app/**/page.tsx',
  'src/app/**/layout.tsx',
  'src/app/**/loading.tsx',
  'src/app/**/error.tsx',
  'src/app/global-error.tsx',
  'src/app/**/not-found.tsx',
  'src/app/**/route.ts',
  'src/app/**/proxy.ts',
  'src/app/**/default.tsx',
  'src/app/**/template.tsx',
  'src/app/**/opengraph-image.tsx',
  'src/app/**/twitter-image.tsx',
  'src/app/**/icon.tsx',
  'src/app/**/sitemap.ts',
  'src/app/**/robots.ts',
  'src/app/**/manifest.ts',
  'src/i18n/request.ts',
  'src/i18n/locales/*.ts',
  'next.config.{js,ts,mjs}',
  'middleware.ts',
  'instrumentation.ts',
  'prisma/config.ts',
];

/** Files emitted by tools (never hand-edited, so never linted). */
export const GENERATED_FILES = ['src/lib/db/contract.d.ts', 'src/lib/db/contract.json'];

export const SOURCE_FILES = ['src/**/*.{ts,tsx}'];
export const MODULE_FILES = ['src/modules/*/**/*.{ts,tsx}'];

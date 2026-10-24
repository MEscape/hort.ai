/**
 * Repository locations the generators read and write. Every path is
 * relative to the repository root and verified against the real layout
 * (docs/conventions/*, eslint/policy/policy.mjs).
 */
export const PATHS = {
  modules: 'src/modules',
  /** Per-locale catalogs that register each module's i18n namespace. */
  locales: 'src/i18n/locales',
  /** Tests mirror `src/` (vitest runs `__tests__/src`). */
  moduleTests: '__tests__/src/modules',
  prismaSchema: 'prisma/schema.prisma',
  /** Shared composites (`ui/` holds shadcn primitives, added with the shadcn CLI). */
  sharedComponents: 'src/components/shared',
  sharedComponentTests: '__tests__/src/components/shared',
  /** App-shell translations: `<locale>.json`. Module namespaces live in the modules. */
  appMessages: 'src/i18n/messages',
  envExample: '.env.example',
} as const;

/** Locales every module must ship translations for (matches `src/i18n/locales`). */
export const LOCALES = ['en', 'de'] as const;
export type Locale = (typeof LOCALES)[number];

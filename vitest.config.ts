import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    // Vercel restores node_modules (and the cache inside it) from the previous build, so a cached transform of a
    // test that uses `import.meta.glob` keeps the module list of that build and a new module is "not covered".
    // The suite is small enough to transform on every run; a stale glob is a harder failure than a slower start.
    fsModuleCache: false,
    globals: true,
    // Needs a database; run by `npm run test:integration` with its own configuration.
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts', '__tests__/e2e/**'],
    // The environment is validated when `@lib/config` is first imported, so `vitest.env.ts` sets it first.
    setupFiles: ['./vitest.env.ts', './vitest.setup.ts'],
    // Form tests type and click through real components; with every worker busy a single one
    // can take several times its time alone (1-2 s), so the default 5 s is too tight to be a signal.
    testTimeout: 15_000,
    // `npm run test:coverage` runs every unit test and measures all of `src`; the report is the
    // overall figure. Each key of `thresholds` is a glob that fails the run on its own files; add
    // one per area that must stay covered (the shared layer is held to 100%, '*.d.ts' excepted).
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.d.ts'],
      reporter: ['text-summary', 'json-summary'],
      thresholds: {
        'src/lib/**': { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
    // next-intl ships ESM with extensionless `next/*` imports; Vite must resolve them.
    server: { deps: { inline: ['next-intl'] } },
  },
  resolve: {
    tsconfigPaths: true,
  },
});

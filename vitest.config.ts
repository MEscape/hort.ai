import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    // Needs a database; run by `npm run test:integration` with its own configuration.
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    // Form tests type and click through real components; with every worker busy a single one
    // can take several times its time alone (1-2 s), so the default 5 s is too tight to be a signal.
    testTimeout: 15_000,
    // The server environment is validated when `@lib/config` is first imported, so any
    // test that touches module code needs a valid one. These are placeholders, not services:
    // nothing here connects to a database.
    env: {
      // Vercel builds run with NODE_ENV=production; React then has no `act` and config validation is strict.
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
      AUTH_DATABASE_URL: 'postgresql://user:pass@localhost:5432/test_auth',
      AUTH_SECRET: 'x'.repeat(40),
      // Rate limiting always uses the Upstash store, so its settings are required too.
      UPSTASH_REDIS_REST_URL: 'http://localhost:8079',
      UPSTASH_REDIS_REST_TOKEN: 'test-token',
    },
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

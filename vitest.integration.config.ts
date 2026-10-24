import 'dotenv/config';

import { defineConfig } from 'vitest/config';

/**
 * Integration tests (`*.integration.test.ts`) run against the local services from
 * `docker-compose.yml`. Settings come from `.env` (loaded above) or the CI job environment, under
 * the application's own variable names, so a test sees exactly what the app would. A test whose
 * service is not configured skips itself.
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.integration.test.ts'],
    env: {
      // CI brings its own migrated database; locally `npm run db:migrate` prepares it.
      DATABASE_URL: process.env['DATABASE_URL'],
      AUTH_DATABASE_URL: process.env['AUTH_DATABASE_URL'],
      AUTH_SECRET: process.env['AUTH_SECRET'],
      // Rate limiting always uses the Upstash store, so its settings are required too.
      UPSTASH_REDIS_REST_URL: process.env['UPSTASH_REDIS_REST_URL'],
      UPSTASH_REDIS_REST_TOKEN: process.env['UPSTASH_REDIS_REST_TOKEN'],
      RATE_LIMIT_SECRET: process.env['RATE_LIMIT_SECRET'],
      // Object storage (Azurite): the Azure adapter's integration test needs all of these.
      STORAGE_PROVIDER: process.env['STORAGE_PROVIDER'],
      STORAGE_AZURE_ACCOUNT_NAME: process.env['STORAGE_AZURE_ACCOUNT_NAME'],
      STORAGE_AZURE_ACCOUNT_KEY: process.env['STORAGE_AZURE_ACCOUNT_KEY'],
      STORAGE_AZURE_BLOB_ENDPOINT: process.env['STORAGE_AZURE_BLOB_ENDPOINT'],
      STORAGE_AZURE_PUBLIC_CONTAINER: process.env['STORAGE_AZURE_PUBLIC_CONTAINER'],
      STORAGE_AZURE_PRIVATE_CONTAINER: process.env['STORAGE_AZURE_PRIVATE_CONTAINER'],
      STORAGE_PUBLIC_BASE_URL: process.env['STORAGE_PUBLIC_BASE_URL'],
    },
    // next-intl ships ESM with extensionless `next/*` imports; Vite must resolve them.
    server: { deps: { inline: ['next-intl'] } },
    // One database, several files: run them one after the other.
    fileParallelism: false,
  },
  resolve: {
    tsconfigPaths: true,
  },
});

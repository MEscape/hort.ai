import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '__tests__/e2e',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: 'list',
  outputDir: 'test-results/e2e',
  use: {
    baseURL: process.env['E2E_BASE_URL'],
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
  },
});

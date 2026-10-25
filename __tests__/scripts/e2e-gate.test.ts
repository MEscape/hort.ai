import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>;
};

describe('the real Vercel learning-journey gate (#18)', () => {
  it('runs browser E2E before building or migrating the deployment database', () => {
    const steps = manifest.scripts['build:vercel']?.split(' && ') ?? [];
    expect(steps).toContain('npm run test:e2e');
    expect(steps.indexOf('npm run test:e2e')).toBeLessThan(steps.indexOf('npm run build'));
    expect(steps.indexOf('npm run test:e2e')).toBeLessThan(steps.indexOf('npm run db:migrate'));
    expect(manifest.scripts['test:e2e']).toContain('tsx __tests__/e2e/run.ts');
  });
});

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const scripts = (
  JSON.parse(readFileSync('package.json', 'utf8')) as {
    scripts: Record<string, string>;
  }
).scripts;
const PRELOAD = './scripts/lib/server-runtime.ts';

/** A real Node/tsx process: Vitest's server-only mock and React resolver cannot hide regressions. */
describe('server CLI runtime (#100)', () => {
  it.each([
    ['db:seed', 'prisma/seed.ts'],
    ['curriculum:ingest', 'scripts/ingest-curriculum.ts'],
  ])('uses the CLI-only preload, not React Server conditions (%s)', (command, entry) => {
    expect(scripts[command]).toBe(`tsx --import ${PRELOAD} ${entry}`);
  });

  it('loads the real seed and ingest import graphs without React hook errors or database writes', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--import',
        PRELOAD,
        '--input-type=module',
        '--eval',
        `await import('@modules/curriculum');
         await import('./prisma/seed/index.ts');
         console.log('server-cli-imports-ok');`,
      ],
      {
        encoding: 'utf8',
        timeout: 60_000,
        env: {
          ...process.env,
          NODE_ENV: 'development',
          AUTH_ENABLED: 'false',
          RATE_LIMIT_ENABLED: 'false',
          DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/not-connected',
          NODE_OPTIONS: '',
        },
      },
    );

    expect(result.error, result.stderr).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('server-cli-imports-ok');
  }, 70_000);
});

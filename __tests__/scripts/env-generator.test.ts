import { rmSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { insertEnvEntry, runEnv } from '../../scripts/commands/env';

import { changedPaths, makeRepo, replaceInFile, snapshot } from './helpers';

const BANNER = '# 7. Public (browser-safe, never a secret)';

function lines(root: string): string[] {
  return (snapshot(root)['.env.example'] ?? '').split('\n');
}

describe('gen env: placement in .env.example', () => {
  it('puts a server variable at the end of the server section, before the PUBLIC banner', () => {
    const root = makeRepo();

    runEnv(
      ['STRIPE_SECRET_KEY', '--description', 'Stripe API secret', '--example', 'sk_test_xxx'],
      { root },
    );

    const file = lines(root);
    const at = file.indexOf('STRIPE_SECRET_KEY=sk_test_xxx');
    expect(at).toBeGreaterThan(file.indexOf('# RATE_LIMIT_TIMEOUT_MS=1500'));
    expect(at).toBeLessThan(file.indexOf(BANNER));
    expect(file[at - 1]).toBe('# Stripe API secret');
    expect(file[at + 1]).toBe('');
    expect(file[at + 2]?.startsWith('# ---')).toBe(true);
  });

  it('appends a public variable at the end, after the public section', () => {
    const root = makeRepo();

    runEnv(
      ['NEXT_PUBLIC_SUPPORT_URL', '--public', '--type', 'url', '--example', 'https://example.org'],
      { root },
    );

    const file = lines(root).filter(
      (line, index, all) => !(line === '' && index === all.length - 1),
    );
    expect(file.at(-1)).toBe('NEXT_PUBLIC_SUPPORT_URL=https://example.org');
    expect(file.indexOf('NEXT_PUBLIC_SUPPORT_URL=https://example.org')).toBeGreaterThan(
      file.indexOf(BANNER),
    );
  });

  it('comments out optional variables, as the existing optional entries are', () => {
    const root = makeRepo();

    runEnv(['FEATURE_LIMIT', '--type', 'number', '--default', '10', '--optional'], { root });

    expect(lines(root)).toContain('# FEATURE_LIMIT=');
  });

  it('changes nothing but .env.example and ends the file with one newline', () => {
    const root = makeRepo();
    const before = snapshot(root);

    runEnv(['EXTRA_SETTING'], { root });

    expect(changedPaths(before, snapshot(root))).toEqual(['.env.example']);
    expect(snapshot(root)['.env.example']?.endsWith('\n')).toBe(true);
    expect(snapshot(root)['.env.example']?.endsWith('\n\n')).toBe(false);
  });

  it('writes nothing on --dry-run', () => {
    const root = makeRepo();
    const before = snapshot(root);

    const output = runEnv(['EXTRA_SETTING', '--dry-run'], { root });

    expect(output).toContain('Would edit 1 file(s):');
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });
});

describe('gen env: the schema line it prints', () => {
  it.each([
    [['A_NAME'], 'serverEnvBaseSchema', 'A_NAME: z.string().min(1),'],
    [
      ['A_NAME', '--type', 'url', '--optional'],
      'serverEnvBaseSchema',
      'A_NAME: z.url().optional(),',
    ],
    [
      ['A_NAME', '--type', 'number', '--default', '10'],
      'serverEnvBaseSchema',
      'A_NAME: z.coerce.number().default(DEFAULT_A_NAME),',
    ],
    [['NEXT_PUBLIC_B', '--public', '--type', 'url'], 'publicEnvSchema', 'NEXT_PUBLIC_B: z.url(),'],
  ])('for %j', (args, schema, line) => {
    const output = runEnv(args, { root: makeRepo() });
    const file =
      schema === 'publicEnvSchema'
        ? 'src/lib/config/public-env-schema.ts'
        : 'src/lib/config/env-schema.ts';

    expect(output).toContain(`Add to ${schema} in ${file}`);
    expect(output).toContain(line);
  });

  it('names the default as a constant, as every default in the real schema is', () => {
    const output = runEnv(['RETRY_LABEL', '--default', 'fast'], { root: makeRepo() });

    expect(output).toContain('const DEFAULT_RETRY_LABEL = "fast";');
  });

  it('warns when a public name looks like a credential, but does not forbid it', () => {
    const output = runEnv(['NEXT_PUBLIC_MAPS_TOKEN', '--public'], { root: makeRepo() });

    expect(output).toContain('looks like a credential');
  });
});

describe('gen env: rejections leave .env.example untouched', () => {
  it.each([
    [[], /Missing variable name/],
    [['stripe_key'], /Invalid name/],
    [['STRIPE-KEY'], /Invalid name/],
    [['NEXT_PUBLIC_X'], /--public was not set/],
    [['X', '--public'], /must start with NEXT_PUBLIC_/],
    [['NEXT_PUBLIC_API_SECRET', '--public'], /looks like a secret/],
    [['DATABASE_URL'], /already in \.env\.example/],
    [['NEXT_PUBLIC_APP_URL', '--public'], /already in \.env\.example/],
    [['X', '--type', 'bogus'], /--type must be one of/],
    [['X', '--type', 'number', '--default', 'abc'], /not a number/],
    [['X', '--type', 'boolean', '--default', 'yes'], /true or false/],
    [['X', 'Y'], /Unexpected argument "Y"/],
    [['X', '--bogus'], /Unknown flag/],
  ])('%j', (args, message) => {
    const root = makeRepo();
    const before = snapshot(root);

    expect(() => runEnv(args, { root })).toThrow(message);
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it('is not fooled by a second run', () => {
    const root = makeRepo();
    runEnv(['ONCE_ONLY'], { root });
    const before = snapshot(root);

    expect(() => runEnv(['ONCE_ONLY'], { root })).toThrow(/already in/);
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it('stops with the exact lines to add by hand when the PUBLIC banner is missing', () => {
    const root = makeRepo();
    replaceInFile(root, '.env.example', BANNER, '# PUBLIC STUFF');
    const before = snapshot(root);

    expect(() => runEnv(['NEW_THING', '--description', 'A thing'], { root })).toThrow(
      /Cannot find the PUBLIC section banner[\s\S]*# A thing\nNEW_THING=/,
    );
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it('fails clearly when .env.example does not exist', () => {
    const root = makeRepo();
    rmSync(join(root, '.env.example'));

    expect(() => runEnv(['A_NAME'], { root })).toThrow(/Expected file not found: \.env\.example/);
  });

  it('refuses a file whose banner is not preceded by a separator line', () => {
    expect(() => insertEnvEntry('A_NAME', '# a\nA_NAME=', false)(`${BANNER}\n`)).toThrow(
      /Cannot find the PUBLIC section banner/,
    );
  });
});

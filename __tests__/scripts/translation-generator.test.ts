import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { addMessage, runTranslation } from '../../scripts/commands/translation';

import { changedPaths, cloneRepo, generateReference, makeRepo, snapshot } from './helpers';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

type Json = Record<string, unknown>;

const json = (root: string, path: string): Json =>
  JSON.parse(readFileSync(join(root, path), 'utf8')) as Json;

let base: string;

beforeAll(async () => {
  base = makeRepo();
  await generateReference(base);
});

describe('gen translation: the app shell', () => {
  it('adds the key to every locale in one change and nothing else', () => {
    const root = makeRepo();
    const before = snapshot(root);

    const output = runTranslation(
      ['home.subtitle', 'Plan your trip', '--de', 'Plane deine Reise'],
      { root },
    );

    expect(changedPaths(before, snapshot(root))).toEqual([
      'src/i18n/messages/de.json',
      'src/i18n/messages/en.json',
    ]);
    expect((json(root, 'src/i18n/messages/en.json')['home'] as Json)['subtitle']).toBe(
      'Plan your trip',
    );
    expect((json(root, 'src/i18n/messages/de.json')['home'] as Json)['subtitle']).toBe(
      'Plane deine Reise',
    );
    expect(output).not.toContain('placeholder text');
  });

  it('marks an untranslated locale so the gap is greppable, and says so', () => {
    const root = makeRepo();

    const output = runTranslation(['home.subtitle', 'Plan your trip'], { root });

    expect((json(root, 'src/i18n/messages/de.json')['home'] as Json)['subtitle']).toBe(
      '[de] Plan your trip',
    );
    expect(output).toContain('Replace the "[de]" placeholder text');
  });

  it('creates a new group, keeps existing key order and the file formatting', () => {
    const root = makeRepo();
    const before = snapshot(root);

    runTranslation(['form.submit', 'Send'], { root });

    const after = snapshot(root)['src/i18n/messages/en.json'] ?? '';
    expect(Object.keys(JSON.parse(after) as Json)).toEqual([
      ...Object.keys(JSON.parse(before['src/i18n/messages/en.json'] ?? '{}') as Json),
      'form',
    ]);
    expect(after).toBe(`${JSON.stringify(JSON.parse(after), null, 2)}\n`);
  });

  it('keeps ICU placeholders, and requires every locale to use the same ones', () => {
    const root = makeRepo();

    runTranslation(['home.greeting', 'Hello {name}', '--de', 'Hallo {name}'], { root });
    expect((json(root, 'src/i18n/messages/de.json')['home'] as Json)['greeting']).toBe(
      'Hallo {name}',
    );

    expect(() =>
      runTranslation(['home.other', 'Hello {name}', '--de', 'Hallo {user}'], { root }),
    ).toThrow(/same placeholders/);
  });
});

describe('gen translation: a module namespace', () => {
  it("adds the key inside the module's namespace in every locale", () => {
    const root = cloneRepo(base);

    runTranslation(
      [
        'errors.locked',
        'Item {name} is locked',
        '--de',
        'Element {name} ist gesperrt',
        '-m',
        'inventory',
      ],
      { root },
    );

    for (const [locale, text] of [
      ['en', 'Item {name} is locked'],
      ['de', 'Element {name} ist gesperrt'],
    ] as const) {
      const file = json(root, `src/modules/inventory/presentation/i18n/${locale}.json`);
      const errors = (file['inventory'] as Json)['errors'] as Json;
      expect(errors['locked']).toBe(text);
      expect(errors['notFound']).toBeDefined();
    }
  });

  it('uses the camelCase namespace of a hyphenated module name', async () => {
    const root = makeRepo();
    await (
      await import('../../scripts/commands/module')
    ).runModule(['data-things', '--stem', 'data-thing', '--fields', 'label:string'], { root });

    runTranslation(['errors.locked', 'Locked', '-m', 'data-things'], { root });

    const file = json(root, 'src/modules/data-things/presentation/i18n/en.json');
    expect(((file['dataThings'] as Json)['errors'] as Json)['locked']).toBe('Locked');
  });
});

describe('gen translation: nothing is written unless every locale accepts the key', () => {
  it('leaves the other locales untouched when only one has a collision', () => {
    const root = makeRepo();
    const german = json(root, 'src/i18n/messages/de.json');
    (german['navigation'] as Json)['probe'] = 'schon da';
    writeFileSync(join(root, 'src/i18n/messages/de.json'), `${JSON.stringify(german, null, 2)}\n`);
    const before = snapshot(root);

    expect(() => runTranslation(['navigation.probe', 'Probe'], { root })).toThrow(
      /already exists in src\/i18n\/messages\/de\.json/,
    );
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it('fails clearly when a locale file is missing, without editing the others', () => {
    const root = makeRepo();
    rmSync(join(root, 'src/i18n/messages/de.json'));
    const before = snapshot(root);

    expect(() => runTranslation(['home.subtitle', 'Plan'], { root })).toThrow(
      /i18n\/messages\/de\.json not found/,
    );
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it('writes nothing on --dry-run', () => {
    const root = makeRepo();
    const before = snapshot(root);

    runTranslation(['home.subtitle', 'Plan', '--dry-run'], { root });

    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });
});

describe('gen translation: rejections', () => {
  it.each([
    [[], /Need a key/],
    [['home.title'], /Need a key/],
    [['home', 'x'], /at least two parts/],
    [['Home.x', 'x'], /at least two parts/],
    [['home.', 'x'], /at least two parts/],
    [['../x.y', 'x'], /at least two parts/],
    [['home.x', ''], /must not be empty/],
    [['home.x', '   '], /must not be empty/],
    [['home.x', '{open'], /unbalanced braces/],
    [['notFound.title', 'again'], /already exists/],
    [['notFound.title.deep', 'x'], /is a message, not a group/],
    [['home.x', 'x', 'extra'], /Unexpected argument "extra"/],
    [['home.x', 'x', '-m', 'nope'], /not found: is "nope" a module/],
    [['home.x', 'x', '-m', '../auth'], /Invalid module name/],
    [['home.x', 'x', '--fr', 'y'], /Unknown flag/],
  ])('%j', (args, message) => {
    const root = makeRepo();
    const before = snapshot(root);

    expect(() => runTranslation(args, { root })).toThrow(message);
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });
});

describe('addMessage', () => {
  it('rejects files that are not a JSON object or lack the namespace', () => {
    expect(() => addMessage('f.json', undefined, 'a.b', 'x')('not json')).toThrow(/not valid JSON/);
    expect(() => addMessage('f.json', undefined, 'a.b', 'x')('[]')).toThrow(
      /must contain a JSON object/,
    );
    expect(() => addMessage('f.json', 'ns', 'a.b', 'x')('{}')).toThrow(/no "ns" namespace/);
  });
});

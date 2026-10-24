import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { I18N_CONFIG } from '@i18n/config';

/**
 * Translation completeness (docs/rules/i18n.md): every catalog has the same
 * keys in every locale, no empty text, and the same ICU arguments, so a
 * locale can never fall back to a raw key or drop a value. Literal keys used
 * in code are already checked by the compiler through the typed catalog.
 */

const ROOT = process.cwd();
const [REFERENCE_LOCALE, ...OTHER_LOCALES] = I18N_CONFIG.locales;

interface Catalog {
  readonly [key: string]: string | Catalog;
}

/** Every catalog by owner: the app shell, then one per module that owns texts. */
function catalogPaths(): ReadonlyArray<{
  readonly owner: string;
  readonly path: (locale: string) => string;
}> {
  // `src/modules` is created with the first module.
  const modulesDir = join(ROOT, 'src/modules');
  const modules = existsSync(modulesDir)
    ? readdirSync(modulesDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => {
          try {
            return readdirSync(join(modulesDir, name, 'presentation/i18n')).length > 0;
          } catch {
            return false;
          }
        })
    : [];
  return [
    { owner: 'app', path: (locale) => `src/i18n/messages/${locale}.json` },
    ...modules.map((name) => ({
      owner: name,
      path: (locale: string) => `src/modules/${name}/presentation/i18n/${locale}.json`,
    })),
  ];
}

function flatten(catalog: Catalog, prefix = ''): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (typeof value === 'string') {
      entries.set(path, value);
    } else {
      for (const [nested, text] of flatten(value, path)) {
        entries.set(nested, text);
      }
    }
  }
  return entries;
}

/** The names of an ICU message's arguments (`{count, plural, …}` → `count`); plural branch text is ignored. */
function argumentNames(text: string): string[] {
  const names = new Set<string>();
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '{') {
      if (depth % 2 === 0) {
        const match = /^\{\s*(\w+)/.exec(text.slice(index));
        if (match?.[1] !== undefined) {
          names.add(match[1]);
        }
      }
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
    }
  }
  return [...names].sort();
}

const load = (path: string) =>
  flatten(JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as Catalog);

describe('translation catalogs', () => {
  const catalogs = catalogPaths();

  it('finds the app shell and the module catalogs', () => {
    expect(catalogs.map((c) => c.owner)).toContain('app');
    expect(catalogs.length).toBeGreaterThan(0);
  });

  for (const { owner, path } of catalogs) {
    for (const locale of OTHER_LOCALES) {
      it(`${owner}: '${locale}' has exactly the keys of '${REFERENCE_LOCALE}', with the same arguments`, () => {
        const reference = load(path(I18N_CONFIG.defaultLocale));
        const translated = load(path(locale));

        expect(
          [...translated.keys()].filter((key) => !reference.has(key)),
          'keys only in the translation',
        ).toEqual([]);
        expect(
          [...reference.keys()].filter((key) => !translated.has(key)),
          'keys missing from the translation',
        ).toEqual([]);
        const argumentMismatches = [...reference].filter(
          ([key, text]) =>
            argumentNames(text).join() !== argumentNames(translated.get(key) ?? '').join(),
        );
        expect(
          argumentMismatches.map(([key]) => key),
          'ICU arguments differ',
        ).toEqual([]);
      });
    }

    it(`${owner}: no text is empty`, () => {
      for (const locale of I18N_CONFIG.locales) {
        const empty = [...load(path(locale))]
          .filter(([, text]) => text.trim() === '')
          .map(([key]) => key);
        expect(empty, `${locale} has empty texts`).toEqual([]);
      }
    });
  }
});

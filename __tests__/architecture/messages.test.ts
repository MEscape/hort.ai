import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { verifyMessageMap } from '../../eslint/policy/checks-behavior.mjs';
import { loadProject } from '../../eslint/policy/index.mjs';

import { describeViolations } from './fixture-tree';

import type { Violation } from './fixture-tree';

const ROOT = process.cwd();
const project = loadProject(ROOT);
const modulesWithMessages = (project.modules as string[]).filter((m) =>
  project.files.has(`src/modules/${m}/presentation/messages/message-keys.ts`),
);

/** Glob, not a template-literal import: Vite cannot resolve a dynamic path without a static extension and warns about it. */
const domainErrorModules = import.meta.glob<Record<string, unknown>>(
  '../../src/modules/*/domain/errors/*.ts',
);

const readCatalog = (moduleName: string, locale: string) =>
  (
    JSON.parse(
      readFileSync(
        join(ROOT, `src/modules/${moduleName}/presentation/i18n/${locale}.json`),
        'utf8',
      ),
    ) as Record<string, unknown>
  )[moduleName.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())];

describe('module message maps', () => {
  it('identifies modules that define message keys', () => {
    expect(Array.isArray(modulesWithMessages)).toBe(true);
  });

  for (const moduleName of modulesWithMessages) {
    it(`${moduleName}: every error and validation code has a key that exists in every locale`, async () => {
      const keys = (await import(
        `../../src/modules/${moduleName}/presentation/messages/message-keys.ts`
      )) as {
        MESSAGE_KEY_BY_CODE: Record<string, string>;
        GENERIC_ERROR_MESSAGE_KEY: string;
        messageKeyForCode: (code: string) => string;
      };
      const codes: string[] = [];
      for (const file of project
        .moduleFiles(moduleName)
        .filter((f: { local: string }) => f.local.startsWith('domain/errors/'))) {
        const load = domainErrorModules[`../../${file.path}`];
        if (load === undefined) {
          throw new Error(`${file.path} is not covered by the domain error glob.`);
        }
        const exported = await load();
        for (const [name, value] of Object.entries(exported)) {
          if (/_(?:ERROR|VALIDATION)_CODES$/.test(name)) {
            codes.push(...Object.values(value as Record<string, string>));
          }
        }
      }
      expect(codes.length).toBeGreaterThan(0);

      const violations: Violation[] = verifyMessageMap({
        module: moduleName,
        codes,
        keyByCode: keys.MESSAGE_KEY_BY_CODE,
        genericKey: keys.GENERIC_ERROR_MESSAGE_KEY,
        catalogs: { en: readCatalog(moduleName, 'en'), de: readCatalog(moduleName, 'de') },
      });
      expect(violations, `\n${describeViolations(violations)}\n`).toEqual([]);

      // unknown codes (another module's, Zod's, a future one) degrade to the generic message
      expect(keys.messageKeyForCode('someone.elses_code')).toBe(keys.GENERIC_ERROR_MESSAGE_KEY);
      expect(keys.messageKeyForCode('toString')).toBe(keys.GENERIC_ERROR_MESSAGE_KEY);
    });
  }
});

interface MapInput {
  module: string;
  codes: string[];
  keyByCode: Record<string, string>;
  genericKey: string;
  catalogs: Record<string, unknown>;
}

describe('verifyMessageMap', () => {
  const base: MapInput = {
    module: 'shop',
    codes: ['shop.not_found', 'shop.name_required'],
    keyByCode: {
      'shop.not_found': 'errors.notFound',
      'shop.name_required': 'validation.nameRequired',
    },
    genericKey: 'errors.generic',
    catalogs: {
      en: { errors: { notFound: 'a', generic: 'b' }, validation: { nameRequired: 'c' } },
      de: { errors: { notFound: 'a', generic: 'b' }, validation: { nameRequired: 'c' } },
    },
  };
  const messages = (input: MapInput) =>
    (verifyMessageMap(input) as Violation[]).map((v) => v.message);

  it('accepts a complete map', () => {
    expect(messages(base)).toEqual([]);
  });

  it('reports a code without a key', () => {
    expect(messages({ ...base, codes: [...base.codes, 'shop.slug_taken'] })).toEqual([
      "Code 'shop.slug_taken' has no entry in MESSAGE_KEY_BY_CODE.",
    ]);
  });

  it('reports a key for a code that does not exist', () => {
    expect(
      messages({ ...base, keyByCode: { ...base.keyByCode, 'shop.ghost': 'errors.generic' } }),
    ).toEqual([
      "MESSAGE_KEY_BY_CODE maps 'shop.ghost', which is not an error or validation code of this module.",
    ]);
  });

  it('reports a key missing from one locale', () => {
    const de = { errors: { notFound: 'a', generic: 'b' }, validation: {} };
    expect(messages({ ...base, catalogs: { ...base.catalogs, de } })).toEqual([
      "Translation key 'validation.nameRequired' is missing in the 'de' catalog.",
    ]);
  });

  it('reports a missing generic fallback translation', () => {
    const en = { errors: { notFound: 'a' }, validation: { nameRequired: 'c' } };
    expect(messages({ ...base, catalogs: { ...base.catalogs, en } })).toEqual([
      "Translation key 'errors.generic' is missing in the 'en' catalog.",
    ]);
  });
});

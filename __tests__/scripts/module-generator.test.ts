import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { runModule } from '../../scripts/commands/module';

import {
  FIELDS,
  REAL_ROOT,
  changedPaths,
  generateReference,
  lintImports,
  lintLimits,
  lintTree,
  linkDirectory,
  localImports,
  makeOutside,
  makeRepo,
  policyViolations,
  replaceInFile,
  resolveImport,
  snapshot,
} from './helpers';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const M = 'src/modules/inventory';

/** Every file `gen module inventory --entity item --client` must create: the structure is the contract. */
const EXPECTED_FILES = [
  '__tests__/src/modules/inventory/item.test.ts',
  `${M}/application/commands/create-item.ts`,
  `${M}/application/commands/delete-item.ts`,
  `${M}/application/commands/update-item.ts`,
  `${M}/application/contracts/inventory-constraints.ts`,
  `${M}/application/contracts/inventory-views.ts`,
  `${M}/application/inventory-dependencies.ts`,
  `${M}/application/inventory-limits.ts`,
  `${M}/application/inventory-view-mappers.ts`,
  `${M}/application/item-scope.ts`,
  `${M}/application/load-authorized-item.ts`,
  `${M}/application/queries/get-item-by-id.ts`,
  `${M}/application/queries/list-items.ts`,
  `${M}/client.ts`,
  `${M}/composition.ts`,
  `${M}/domain/errors/inventory-errors.ts`,
  `${M}/domain/models/ids.ts`,
  `${M}/domain/models/item.ts`,
  `${M}/domain/ports/inventory-audit-log.port.ts`,
  `${M}/domain/ports/item.repository.ts`,
  `${M}/index.ts`,
  `${M}/infrastructure/audit/logger-inventory-audit-log.ts`,
  `${M}/infrastructure/prisma/item-record-mapper.ts`,
  `${M}/infrastructure/prisma/prisma-item.repository.ts`,
  `${M}/presentation/actions/create-item-action.ts`,
  `${M}/presentation/actions/delete-item-action.ts`,
  `${M}/presentation/actions/update-item-action.ts`,
  `${M}/presentation/dto/item-dto.ts`,
  `${M}/presentation/i18n/de.json`,
  `${M}/presentation/i18n/en.json`,
  `${M}/presentation/messages/message-keys.ts`,
  `${M}/presentation/routes.ts`,
  `${M}/presentation/schemas/delete-item-schema.ts`,
  `${M}/presentation/schemas/item-edit-schema.ts`,
  `${M}/presentation/schemas/item-fields-schema.ts`,
  `${M}/presentation/schemas/new-item-schema.ts`,
  `${M}/presentation/schemas/parse-inventory-input.ts`,
];
const LOCALE_FILES = ['src/i18n/locales/de.ts', 'src/i18n/locales/en.ts'];

describe('gen module: the reference module', () => {
  let root: string;
  let before: Record<string, string>;
  let output: string;
  let after: Record<string, string>;

  beforeAll(async () => {
    root = makeRepo();
    before = snapshot(root);
    output = await generateReference(root, ['--client']);
    after = snapshot(root);
  });

  it('creates exactly the expected files and edits only the two locale registries', () => {
    expect(changedPaths(before, after)).toEqual([...EXPECTED_FILES, ...LOCALE_FILES].sort());
    for (const file of EXPECTED_FILES) {
      expect(before[file]).toBeUndefined();
    }
  });

  it('summarises what it did and prints the manual steps that need a decision', () => {
    expect(output).toContain('Created 37 file(s):');
    expect(output).toContain('Edited 2 file(s):');
    expect(output).toContain('model Item {');
    expect(output).toContain('enum ItemStatus {');
    expect(output).toContain('@@unique([tenantId, name])');
    expect(output).toContain("'item.create', 'item.read', 'item.update', 'item.delete'");
    expect(output).toContain('docs/conventions/adding-a-database-migration.md');
    expect(output).not.toMatch(/--name/);
  });

  it('registers the i18n namespace in both locales, in sorted position', () => {
    for (const locale of ['en', 'de']) {
      const source = after[`src/i18n/locales/${locale}.ts`] ?? '';
      expect(source).toContain(
        `import { ${locale}Inventory as inventory } from '@modules/inventory';`,
      );
      expect(source).toContain('  inventory: inventory.inventory,');

      const keys = [...source.matchAll(/^ {2}(\w+)(?::|,)/gm)].map((m) => m[1] ?? '');
      const ordered = keys.filter((key) => key !== 'app');
      expect(ordered).toEqual([...ordered].sort());
      const imports = [...source.matchAll(/from '@modules\/([\w-]+)'/g)].map((m) => m[1] ?? '');
      expect(imports).toEqual([...imports].sort());
    }
  });

  it('only imports things that exist: every relative and module import resolves', () => {
    const unresolved: string[] = [];
    for (const [file, source] of Object.entries(after)) {
      if (!EXPECTED_FILES.includes(file) || !file.endsWith('.ts')) {
        continue;
      }
      for (const specifier of localImports(source)) {
        if (specifier === '@modules/auth') {
          continue;
        }
        if (resolveImport(after, file, specifier) === undefined) {
          unresolved.push(`${file} -> ${specifier}`);
        }
      }
    }
    expect(unresolved).toEqual([]);
  });

  it('uses only current shared layers: no stale aliases, no classic Prisma', () => {
    const lib = new Set<string>();
    for (const [file, source] of Object.entries(after)) {
      if (!EXPECTED_FILES.includes(file)) {
        continue;
      }
      expect(source, file).not.toMatch(/@prisma\/client|@\/lib|lib\/results|actionOk|actionFail/);
      for (const match of source.matchAll(/from '(@lib\/[^']+)'/g)) {
        lib.add(match[1] ?? '');
      }
    }
    expect(lib.size).toBeGreaterThan(5);
    for (const specifier of lib) {
      const [, name = ''] = specifier.split('/');
      expect(
        snapshotHasLib(name),
        `${specifier} does not exist in src/lib of the real repository`,
      ).toBe(true);
    }
  });

  it('follows the use case, action and wiring conventions', () => {
    const create = after[`${M}/application/commands/create-item.ts`] ?? '';
    expect(create).toContain('export class CreateItem');
    expect(create).toContain("requireInTenant('item.create')");
    expect(create).toContain('audit.record(');

    const repository = after[`${M}/infrastructure/prisma/prisma-item.repository.ts`] ?? '';
    expect(repository).toContain('db.orm.public.Item');
    expect(repository).toContain('.limit(limit)');
    expect(repository).toContain('failures.orConflict');
    expect(repository).toContain('this.clock.now()');

    const composition = after[`${M}/composition.ts`] ?? '';
    expect(composition.startsWith("import 'server-only';")).toBe(true);
    expect(composition).toContain('export const inventoryCommands = {');
    expect(composition).toContain('export const inventoryQueries = {');

    for (const action of ['create', 'update', 'delete']) {
      const source = after[`${M}/presentation/actions/${action}-item-action.ts`] ?? '';
      expect(source.startsWith("'use server';")).toBe(true);
      expect(source).toContain('toActionResult(');
      expect(source).toContain('revalidatePath(');
    }

    const index = after[`${M}/index.ts`] ?? '';
    expect(index).toContain("export { inventoryQueries } from './composition';");
    expect(index).toContain('enInventory');
    expect(index).toContain('deInventory');
    expect(index).not.toContain('inventoryCommands');

    expect(
      localImports(after[`${M}/client.ts`] ?? '').filter((path) => path.includes('composition')),
    ).toEqual([]);
  });

  it('ships the same translation keys in every locale, for every error and validation code', () => {
    const en = JSON.parse(after[`${M}/presentation/i18n/en.json`] ?? '{}') as Record<
      string,
      unknown
    >;
    const de = JSON.parse(after[`${M}/presentation/i18n/de.json`] ?? '{}') as Record<
      string,
      unknown
    >;

    const keys = (value: unknown, prefix = ''): string[] =>
      typeof value === 'object' && value !== null
        ? Object.entries(value).flatMap(([key, child]) => keys(child, `${prefix}${key}.`))
        : [prefix.slice(0, -1)];

    expect(keys(en).sort()).toEqual(keys(de).sort());
    expect(keys(en)).toEqual(
      expect.arrayContaining([
        'inventory.errors.notFound',
        'inventory.errors.alreadyExists',
        'inventory.validation.idInvalid',
        'inventory.validation.required',
        'inventory.validation.optionUnknown',
      ]),
    );
  });

  it('passes every whole-tree architecture check and every architecture lint rule', async () => {
    expect(policyViolations(root)).toEqual([]);
    expect(await lintTree(root)).toEqual([]);
  });

  it("follows the repository's import order and size limits", async () => {
    expect(
      await lintImports(root, [
        `${M}/**/*.ts`,
        '__tests__/src/modules/inventory/*.ts',
        'src/i18n/locales/*.ts',
      ]),
    ).toEqual([]);
    expect(await lintLimits(root)).toEqual([]);
  });

  it('is deterministic: the same input produces byte-identical files', async () => {
    const other = makeRepo();
    await generateReference(other, ['--client']);

    const again = snapshot(other);
    for (const file of [...EXPECTED_FILES, ...LOCALE_FILES]) {
      expect(again[file], file).toBe(after[file]);
    }
  });
});

function snapshotHasLib(name: string): boolean {
  return Object.keys(snapshot(join(REAL_ROOT, 'src/lib'))).some(
    (path) => path === `${name}.ts` || path.startsWith(`${name}/`),
  );
}

describe('gen module: options and variants', () => {
  it('omits client.ts and the test unless asked / when disabled', async () => {
    const withDefaults = await runModule(['things', '--fields', 'title:string', '--dry-run'], {
      root: makeRepo(),
    });
    expect(withDefaults).not.toContain('client.ts');
    expect(withDefaults).toContain('__tests__/src/modules/things/thing.test.ts');

    const noTests = await runModule(
      ['things', '--fields', 'title:string', '--no-tests', '--client', '--dry-run'],
      { root: makeRepo() },
    );
    expect(noTests).toContain('client.ts');
    expect(noTests).not.toContain('thing.test.ts');
  });

  it('writes nothing on --dry-run and says what it would do', async () => {
    const root = makeRepo();
    const before = snapshot(root);

    const output = await runModule(['inventory', '--fields', FIELDS, '--dry-run'], { root });

    expect(output).toContain('Would create 36 file(s):');
    expect(output).toContain('Would edit 2 file(s):');
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it.each([
    {
      name: 'a single required text field, no unique constraint',
      args: ['notes', '--fields', 'title:string'],
      module: 'notes',
      absent: ['alreadyExists', 'ConflictAppError'],
    },
    {
      name: 'a boolean-only entity (no validation codes at all)',
      args: ['toggles', '--fields', 'on:boolean'],
      module: 'toggles',
      absent: ['optionUnknown', 'tooLong', 'numberInvalid', 'dateInvalid'],
    },
    {
      name: 'a plural folder with a different stem and entity, optional enum and date',
      args: [
        'data-things',
        '--stem',
        'data-thing',
        '--entity',
        'gadget',
        '--fields',
        'label:string,weight:number?,state:enum(on|off)?,purchased:date',
        '--unique',
        'label',
      ],
      module: 'data-things',
      absent: [],
    },
    {
      name: 'several unique fields and optional numbers',
      args: [
        'ledgers',
        '--fields',
        'code:string,account:string,balance:money?,ratio:number?,flagged:boolean',
        '--unique',
        'code,account',
      ],
      module: 'ledgers',
      absent: [],
    },
  ])('generates a valid module for $name', async ({ args, module, absent }) => {
    const root = makeRepo();
    await runModule(args, { root });
    const files = snapshot(root);
    const generated = Object.entries(files).filter(([path]) =>
      path.startsWith(`src/modules/${module}/`),
    );

    expect(policyViolations(root)).toEqual([]);
    expect(await lintTree(root)).toEqual([]);
    expect(await lintImports(root, [`src/modules/${module}/**/*.ts`])).toEqual([]);
    for (const token of absent) {
      expect(
        generated.filter(([, source]) => source.includes(token)).map(([path]) => path),
      ).toEqual([]);
    }
  });

  it('keeps every generated function within the complexity and parameter limits for many fields', async () => {
    const root = makeRepo();
    const fields = [
      'a:string,b:string,c:string,d:string,e:string?,f:number,g:number,h:money,i:money?',
      'j:date,k:date?,l:boolean,m:boolean,n:enum(x|y),o:enum(p|q)?,pp:string,q:string,r:number',
    ].join(',');

    await runModule(['widgets', '--fields', fields], { root });

    expect(await lintLimits(root)).toEqual([]);
    expect(policyViolations(root)).toEqual([]);
  });
});

describe('gen module: input validation', () => {
  it.each([
    [['../x', '--fields', 'a:string'], /Invalid module name/],
    [['a/b', '--fields', 'a:string'], /Invalid module name/],
    [['Order', '--fields', 'a:string'], /Invalid module name/],
    [['class', '--fields', 'a:string'], /Invalid module name|reserved/],
    [['x_y', '--fields', 'a:string'], /Invalid module name/],
    [['-x', '--fields', 'a:string'], /Unknown flag/],
    [['switches', '--fields', 'a:string'], /reserved word/],
    [[], /Missing module name/],
    [['things'], /Missing --fields/],
    [['things', '--fields', 'x:nope'], /Unknown field type/],
    [['things', '--fields', 'x:string,x:number'], /Duplicate field/],
    [['things', '--fields', 'id:string'], /cannot be a field name/],
    [['things', '--fields', 'x:string', '--unique', 'y'], /not a declared field/],
    [['things', '--fields', 'x:string', '--bogus'], /Unknown flag/],
    [['things', 'extra', '--fields', 'x:string'], /Unexpected argument "extra"/],
    [['things', '--stem', 'Bad', '--fields', 'x:string'], /Invalid stem/],
  ])('rejects %j without touching the repository', async (args, message) => {
    const root = makeRepo();
    const before = snapshot(root);

    await expect(runModule(args, { root })).rejects.toThrow(message);
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it('shows help without writing anything', async () => {
    const root = makeRepo();
    const before = snapshot(root);

    const help = await runModule(['--help'], { root });

    expect(help).toContain('--fields');
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });
});

describe('gen module: existing work is never overwritten', () => {
  it('refuses an existing module and leaves it byte-identical', async () => {
    const root = makeRepo();
    await generateReference(root);
    writeFileSync(join(root, `${M}/domain/models/item.ts`), '// hand-written business rules\n');
    const before = snapshot(root);

    await expect(generateReference(root)).rejects.toThrow(/Module "inventory" already exists/);
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it('aborts on a conflicting file outside the module folder and writes nothing', async () => {
    const root = makeRepo();
    mkdirSync(join(root, '__tests__/src/modules/inventory'), { recursive: true });
    writeFileSync(join(root, '__tests__/src/modules/inventory/item.test.ts'), '// my test\n');
    const before = snapshot(root);

    await expect(generateReference(root)).rejects.toThrow(
      /Refusing to overwrite 1 existing file\(s\)[\s\S]*__tests__\/src\/modules\/inventory\/item\.test\.ts/,
    );
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it('refuses to register a namespace that is already registered', async () => {
    const root = makeRepo();
    replaceInFile(
      root,
      'src/i18n/locales/en.ts',
      'const messages = {',
      'const messages = {\n  inventory: other.inventory,',
    );
    const before = snapshot(root);

    await expect(generateReference(root)).rejects.toThrow(/already registers "inventory"/);
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });
});

describe('gen module: failure handling', () => {
  it('aborts before writing anything when a locale file has an unexpected shape', async () => {
    const root = makeRepo();
    replaceInFile(root, 'src/i18n/locales/de.ts', 'const messages = {', 'const strings = {');
    const before = snapshot(root);

    await expect(generateReference(root)).rejects.toThrow(/unexpected shape/);
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it('rolls everything back when a write fails midway', async () => {
    const root = makeRepo();
    // A file where the test directory must be: the last created file cannot be written.
    mkdirSync(join(root, '__tests__/src'), { recursive: true });
    writeFileSync(join(root, '__tests__/src/modules'), 'not a directory');
    const before = snapshot(root);

    await expect(generateReference(root)).rejects.toThrow(/rolled back/);
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it('never writes outside the repository through a symlinked directory', async () => {
    const root = makeRepo();
    const outside = makeOutside();
    mkdirSync(join(root, '__tests__/src'), { recursive: true });
    linkDirectory(outside, join(root, '__tests__/src/modules'));
    const before = snapshot(root);

    await expect(generateReference(root)).rejects.toThrow(/resolves outside the repository/);
    expect(snapshot(outside)).toEqual({});
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it('does not depend on the process working directory', async () => {
    const root = makeRepo();
    const previous = process.cwd();
    process.chdir(makeOutside());
    try {
      await generateReference(root);
    } finally {
      process.chdir(previous);
    }

    expect(Object.keys(snapshot(root))).toContain(`${M}/composition.ts`);
  });
});

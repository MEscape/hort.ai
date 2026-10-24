import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { runUseCase } from '../../scripts/commands/usecase';

import {
  changedPaths,
  cloneRepo,
  generateReference,
  lintImports,
  lintLimits,
  lintTree,
  makeRepo,
  policyViolations,
  replaceInFile,
  snapshot,
} from './helpers';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const M = 'src/modules/inventory';
const AUDIT_PORT = `${M}/domain/ports/inventory-audit-log.port.ts`;
const AUDIT_LOGGER = `${M}/infrastructure/audit/logger-inventory-audit-log.ts`;

let base: string;

beforeAll(async () => {
  base = makeRepo();
  await generateReference(base);
});

/** The manual step `gen usecase` prints for a command: declare its audit event and level. */
function declareAuditEvent(root: string, type: string): void {
  replaceInFile(
    root,
    AUDIT_PORT,
    '    };\n\n/** Append-only',
    `    }\n  | {\n      readonly type: '${type}';\n      readonly actorId: ActorId;\n      readonly tenantId: TenantId;\n      readonly itemId: ItemId;\n    };\n\n/** Append-only`,
  );
  replaceInFile(
    root,
    AUDIT_LOGGER,
    "  'item.deleted': 'info',",
    `  'item.deleted': 'info',\n  '${type}': 'info',`,
  );
}

async function expectHealthy(root: string): Promise<void> {
  expect(policyViolations(root)).toEqual([]);
  expect(await lintTree(root)).toEqual([]);
  expect(await lintImports(root, [`${M}/**/*.ts`])).toEqual([]);
  expect(await lintLimits(root)).toEqual([]);
}

describe('gen usecase: a command', () => {
  it('creates the use case and registers it in the composition root', async () => {
    const root = cloneRepo(base);
    const before = snapshot(root);

    const output = await runUseCase(['archive-item', '-m', 'inventory'], { root });

    expect(changedPaths(before, snapshot(root))).toEqual([
      `${M}/application/commands/archive-item.ts`,
      `${M}/composition.ts`,
    ]);
    const useCase = readFileSync(join(root, `${M}/application/commands/archive-item.ts`), 'utf8');
    expect(useCase).toContain('export class ArchiveItem');
    expect(useCase).toContain("loadAuthorizedItem(this.deps, input.id, 'item.archive')");
    expect(useCase).toContain("type: 'item.archive_item'");
    expect(output).toContain('Next steps (manual)');
    expect(output).toContain("Add the permission 'item.archive'");
    expect(output).toContain("type: 'item.archive_item'");

    const composition = readFileSync(join(root, `${M}/composition.ts`), 'utf8');
    expect(composition).toContain(
      "import { ArchiveItem } from './application/commands/archive-item';",
    );
    expect(composition).toContain('archiveItem: new ArchiveItem(dependencies),');
  });

  it('is flagged by the architecture policy until the audit event is declared, then clean', async () => {
    const root = cloneRepo(base);
    await runUseCase(['archive-item', '-m', 'inventory'], { root });

    const violations = policyViolations(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatch(/item\.archive_item.*not part of InventoryEvent/);

    declareAuditEvent(root, 'item.archive_item');
    await expectHealthy(root);
  });

  it('keeps imports sorted and appends properties across several use cases', async () => {
    const root = cloneRepo(base);
    await runUseCase(['restore-item', '-m', 'inventory'], { root });
    await runUseCase(['archive-item', '-m', 'inventory'], { root });
    await runUseCase(['list-low-stock', '-m', 'inventory', '--query'], { root });

    const composition = readFileSync(join(root, `${M}/composition.ts`), 'utf8');
    const useCasePaths = [
      ...composition.matchAll(/from '\.\/application\/((?:commands|queries)\/[\w-]+)'/g),
    ].map((m) => m[1] ?? '');
    expect(useCasePaths).toEqual([
      'commands/archive-item',
      'commands/create-item',
      'commands/delete-item',
      'commands/restore-item',
      'commands/update-item',
      'queries/get-item-by-id',
      'queries/list-items',
      'queries/list-low-stock',
    ]);
    expect(await lintImports(root, [`${M}/composition.ts`])).toEqual([]);
    expect(composition.indexOf('restoreItem:')).toBeLessThan(composition.indexOf('archiveItem:'));
  });
});

describe('gen usecase: a query', () => {
  it('needs no manual step: no audit, no new permission', async () => {
    const root = cloneRepo(base);

    await runUseCase(['list-low-stock', '-m', 'inventory', '--query'], { root });

    const source = readFileSync(join(root, `${M}/application/queries/list-low-stock.ts`), 'utf8');
    expect(source).toContain("loadAuthorizedItem(this.deps, id, 'item.read')");
    expect(source).not.toMatch(/audit\.record|const \{[^}]*audit/);
    expect(readFileSync(join(root, `${M}/composition.ts`), 'utf8')).toContain(
      'listLowStock: new ListLowStock(dependencies),',
    );
    await expectHealthy(root);
  });
});

describe('gen usecase: --action', () => {
  it('adds the input schema and Server Action next to the command', async () => {
    const root = cloneRepo(base);
    const before = snapshot(root);

    await runUseCase(['archive-item', '-m', 'inventory', '--action'], { root });

    expect(changedPaths(before, snapshot(root))).toEqual([
      `${M}/application/commands/archive-item.ts`,
      `${M}/composition.ts`,
      `${M}/presentation/actions/archive-item-action.ts`,
      `${M}/presentation/schemas/archive-item-schema.ts`,
    ]);
    const action = readFileSync(
      join(root, `${M}/presentation/actions/archive-item-action.ts`),
      'utf8',
    );
    expect(action.startsWith("'use server';")).toBe(true);
    expect(action).toContain('inventoryCommands.archiveItem.execute(command)');
    expect(action).toContain('Promise<ActionResult<void>>');
    expect(action).toContain('revalidatePath(inventoryRoutes.list())');
    expect(
      readFileSync(join(root, `${M}/presentation/schemas/archive-item-schema.ts`), 'utf8'),
    ).toContain('z.object({ id: itemIdSchema })');

    declareAuditEvent(root, 'item.archive_item');
    await expectHealthy(root);
  });

  it.each([
    [['x-y', '-m', 'inventory', '--query', '--action'], /commands only/],
    [['x-y', '-m', 'inventory', '--action', '--no-wire'], /drop --no-wire/],
  ])('rejects %j', async (args, message) => {
    const root = cloneRepo(base);
    const before = snapshot(root);

    await expect(runUseCase(args, { root })).rejects.toThrow(message);
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it('refuses, writing nothing, when the module lacks the standard presentation pieces', async () => {
    const root = cloneRepo(base);
    writeFileSync(join(root, `${M}/presentation/routes.ts`), 'export const somethingElse = 1;\n');
    const before = snapshot(root);

    await expect(
      runUseCase(['archive-item', '-m', 'inventory', '--action'], { root }),
    ).rejects.toThrow(/deviates from the standard presentation shape[\s\S]*inventoryRoutes/);
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });
});

describe('gen usecase: names come from the module, not from assumptions', () => {
  it("reuses the module's own permission resource and audit event prefix", async () => {
    const root = cloneRepo(base);
    for (const folder of ['commands', 'queries']) {
      for (const [path, content] of Object.entries(snapshot(root))) {
        if (path.startsWith(`${M}/application/${folder}/`)) {
          writeFileSync(join(root, path), content.replaceAll("'item.", "'stock."));
        }
      }
    }
    writeFileSync(
      join(root, AUDIT_PORT),
      readFileSync(join(root, AUDIT_PORT), 'utf8').replaceAll("'item.", "'stock."),
    );

    const output = await runUseCase(['archive-item', '-m', 'inventory'], { root });

    const useCase = readFileSync(join(root, `${M}/application/commands/archive-item.ts`), 'utf8');
    expect(useCase).toContain("'stock.archive'");
    expect(useCase).toContain("type: 'stock.archive_item'");
    expect(output).toContain("Add the permission 'stock.archive'");
  });

  it('asks for --entity when the module has several loaders, and validates it', async () => {
    const root = cloneRepo(base);
    writeFileSync(join(root, `${M}/application/load-authorized-other.ts`), 'export {};\n');

    await expect(runUseCase(['archive-item', '-m', 'inventory'], { root })).rejects.toThrow(
      /Cannot tell the entity[\s\S]*--entity/,
    );
    await expect(
      runUseCase(['archive-item', '-m', 'inventory', '--entity', 'nope'], { root }),
    ).rejects.toThrow(/no load-authorized-nope\.ts/);
    await expect(
      runUseCase(['archive-item', '-m', 'inventory', '--entity', 'item', '--dry-run'], { root }),
    ).resolves.toContain('Would create 1 file(s)');
  });
});

describe('gen usecase: refusals that write nothing', () => {
  it.each([
    [[], /Missing use case name/],
    [['x-y'], /Missing -m <module>/],
    [['../x', '-m', 'inventory'], /Invalid use case name/],
    [['X', '-m', 'inventory'], /Invalid use case name/],
    [['x-y', '-m', '../auth'], /Invalid module name/],
    [['x-y', '-m', 'nope'], /not found at src\/modules\/nope/],
    [['x-y', '-m', 'inventory', 'extra'], /Unexpected argument "extra"/],
    [['x-y', '-m', 'inventory', '--bogus'], /Unknown flag/],
  ])('rejects %j', async (args, message) => {
    const root = cloneRepo(base);
    const before = snapshot(root);

    await expect(runUseCase(args, { root })).rejects.toThrow(message);
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it('never overwrites an existing use case and leaves the composition root alone', async () => {
    const root = cloneRepo(base);
    await runUseCase(['archive-item', '-m', 'inventory'], { root });
    writeFileSync(
      join(root, `${M}/application/commands/archive-item.ts`),
      '// my business rules\n',
    );
    const before = snapshot(root);

    await expect(runUseCase(['archive-item', '-m', 'inventory'], { root })).rejects.toThrow(
      /Refusing to overwrite 1 existing file\(s\)/,
    );
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it('refuses modules that are not standard business modules', async () => {
    const root = makeRepo();
    mkdirSync(join(root, 'src/modules/map/application'), { recursive: true });
    writeFileSync(join(root, 'src/modules/map/application/map-dependencies.ts'), 'export {};\n');

    await expect(runUseCase(['x-y', '-m', 'map'], { root })).rejects.toThrow(
      /not a standard business module/,
    );
    await expect(runUseCase(['x-y', '-m', 'absent'], { root })).rejects.toThrow(/not found/);
  });

  it('refuses modules whose loader deviates, naming what is missing', async () => {
    const root = cloneRepo(base);
    writeFileSync(
      join(root, `${M}/application/load-authorized-item.ts`),
      'export const other = 1;\n',
    );
    const before = snapshot(root);

    await expect(runUseCase(['archive-item', '-m', 'inventory'], { root })).rejects.toThrow(
      /deviates from the standard module shape[\s\S]*loadAuthorizedItem\(\)[\s\S]*LoadItemError/,
    );
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it('refuses a query for a module without the view mapper it relies on', async () => {
    const root = cloneRepo(base);
    writeFileSync(join(root, `${M}/application/inventory-view-mappers.ts`), 'export {};\n');

    await expect(runUseCase(['x-y', '-m', 'inventory', '--query'], { root })).rejects.toThrow(
      /does not export toItemView\(\)/,
    );
  });

  it('aborts, writing nothing, and prints the snippet when composition.ts has an unexpected shape', async () => {
    const root = cloneRepo(base);
    replaceInFile(
      root,
      `${M}/composition.ts`,
      'export const inventoryCommands = {',
      'export const commandsOfInventory = {',
    );
    const before = snapshot(root);

    await expect(runUseCase(['archive-item', '-m', 'inventory'], { root })).rejects.toThrow(
      /does not have the expected shape[\s\S]*archiveItem: new ArchiveItem\(dependencies\)[\s\S]*--no-wire/,
    );
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it('can skip the wiring explicitly and still creates the file', async () => {
    const root = cloneRepo(base);
    const before = snapshot(root);

    await runUseCase(['archive-item', '-m', 'inventory', '--no-wire'], { root });

    expect(changedPaths(before, snapshot(root))).toEqual([
      `${M}/application/commands/archive-item.ts`,
    ]);
  });

  it('writes nothing on --dry-run', async () => {
    const root = cloneRepo(base);
    const before = snapshot(root);

    const output = await runUseCase(['archive-item', '-m', 'inventory', '--action', '--dry-run'], {
      root,
    });

    expect(output).toContain('Would create 3 file(s):');
    expect(output).toContain('Would edit 1 file(s):');
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });
});

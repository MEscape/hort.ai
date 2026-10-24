import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

import { architectureRules } from '../../eslint/config/architecture.mjs';
import { runAllChecks } from '../../eslint/policy/index.mjs';

import { makeTree, relativeToRoot } from './fixture-tree';
import { MODULE, standardModule } from './standard-module';

const M = `src/modules/${MODULE}`;

/** Lints a tree with ONLY the repository's architecture rule blocks (no per-module configuration). */
async function lint(root: string): Promise<string[]> {
  const eslint = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { ecmaFeatures: { jsx: true } },
        },
      },
      ...architectureRules,
    ],
  });
  const results = await eslint.lintFiles(['src/**/*.{ts,tsx}']);
  return results.flatMap((r) =>
    r.messages.map(
      (m) => `${relativeToRoot(r.filePath, root)}:${m.line} [${m.ruleId}] ${m.message}`,
    ),
  );
}

function tree(mutate?: (files: Record<string, string>) => void): string {
  const files = standardModule();
  mutate?.(files);
  return makeTree(files);
}

const replaceIn = (
  files: Record<string, string>,
  path: string,
  from: string | RegExp,
  to: string,
) => {
  const before = files[path];
  if (before === undefined) {
    throw new Error(`fixture has no ${path}`);
  }
  const after = before.replace(from, to);
  if (after === before) {
    throw new Error(`mutation did not change ${path}`);
  }
  files[path] = after;
};

describe('a new standard module', () => {
  it('passes every lint rule without any configuration change', async () => {
    const messages = await lint(tree());
    expect(messages).toEqual([]);
  });

  it('passes every whole-tree architecture check without any policy change', () => {
    const violations = runAllChecks(tree());
    expect(
      violations.map(
        (v: { group: string; file: string; message: string }) =>
          `[${v.group}] ${v.file}: ${v.message}`,
      ),
    ).toEqual([]);
  });
});

/**
 * Gives the module one rate-limit policy (`INVENTORY_RATE_LIMITS.create`) that `create-item` spends,
 * with fields overridden by `fields`: the starting point of the policy mutations below.
 */
function withPolicy(
  files: Record<string, string>,
  fields: { id?: string; onBackendFailure?: string; second?: boolean; failOpenComment?: string },
  options: { isSpent?: boolean } = {},
): void {
  const policy = (id: string) =>
    `${fields.failOpenComment ? `// @fail-open ${fields.failOpenComment}\n` : ''}{ id: ${id}, limit: 10, windowSeconds: 60, onBackendFailure: ${fields.onBackendFailure ?? "'deny'"} }`;
  const entries = [`create: ${policy(fields.id ?? "'inventory.create'")},`];
  if (fields.second === true) {
    entries.push(`update: ${policy("'inventory.create'")},`);
  }
  files[`${M}/application/rate-limits.ts`] = [
    "import type { RateLimitPolicy } from '@lib/rate-limit';",
    "const FAILURE_MODE = 'deny' as 'deny' | 'allow';",
    `export const INVENTORY_RATE_LIMITS = { ${entries.join(' ')} } as const satisfies Record<string, RateLimitPolicy>;`,
    '',
  ].join('\n');
  if (options.isSpent === false) {
    return;
  }
  const spends = ['create', ...(fields.second === true ? ['update'] : [])]
    .map((key) => `export const ${key}Budget = INVENTORY_RATE_LIMITS.${key};`)
    .join('\n');
  replaceIn(
    files,
    `${M}/application/commands/create-item.ts`,
    'export class CreateItem',
    `${spends}\nexport class CreateItem`,
  );
}

interface Mutation {
  readonly name: string;
  readonly mutate: (files: Record<string, string>) => void;
  /** Expected lint diagnostic (`[rule] message`), when a single-file rule owns it. */
  readonly lint?: RegExp;
  /** Expected whole-tree violation (`[group] file: message`), when it needs more than one file. */
  readonly tree?: RegExp;
}

const mutations: Mutation[] = [
  {
    name: 'a protected dependency set without audit',
    mutate: (f) => {
      replaceIn(
        f,
        `${M}/application/inventory-dependencies.ts`,
        '  readonly audit: InventoryAuditLog;\n',
        '',
      );
    },
    // the dependency set is resolved end to end from the command that is built from it
    tree: /\[command audit dependency\].*which has no `audit` member/,
  },
  {
    name: 'an audit adapter that is never wired in composition',
    mutate: (f) => {
      replaceIn(
        f,
        `${M}/composition.ts`,
        "import { loggerInventoryAuditLog } from './infrastructure/audit/logger-inventory-audit-log';\n",
        '',
      );
      replaceIn(
        f,
        `${M}/composition.ts`,
        'audit: loggerInventoryAuditLog',
        'audit: { record: () => undefined }',
      );
    },
    tree: /\[composition wiring\].*`loggerInventoryAuditLog` is typed as InventoryAuditLog but composition\.ts never imports it/,
  },
  {
    name: 'a command that imports an infrastructure class',
    mutate: (f) => {
      replaceIn(
        f,
        `${M}/application/commands/create-item.ts`,
        'import type { InventoryDependencies }',
        "import { PrismaItemRepository } from '../../infrastructure/prisma/prisma-item.repository';\nimport type { InventoryDependencies }",
      );
    },
    lint: /\[architecture\/layer-imports\] Application must not import infrastructure/,
    tree: /\[layer dependencies\].*Application must not import infrastructure/,
  },
  {
    name: 'application code that calls another module at runtime',
    mutate: (f) => {
      replaceIn(
        f,
        `${M}/application/inventory-scope.ts`,
        'import type { ResourceScope }',
        "import { toTenantId } from '@modules/auth';\nimport type { ResourceScope }",
      );
    },
    lint: /\[architecture\/layer-imports\] Application may only `import type` from another module/,
    tree: /\[layer dependencies\]/,
  },
  {
    name: 'a hard-coded list limit in a query',
    mutate: (f) => {
      replaceIn(
        f,
        `${M}/application/queries/list-items.ts`,
        'ITEM_LIST_LIMITS.default, ITEM_LIST_LIMITS.min, ITEM_LIST_LIMITS.max',
        '25, 1, 100',
      );
    },
    lint: /\[architecture\/limits-usage\] Clamp bounds are limits/,
  },
  {
    name: 'a thrown business error',
    mutate: (f) => {
      replaceIn(
        f,
        `${M}/application/commands/create-item.ts`,
        'const { authorization, audit } = this.deps;',
        "if (input.name === '') { throw new Error('empty'); }\n    const { authorization, audit } = this.deps;",
      );
    },
    lint: /\[architecture\/no-throw-in-core-layers\] Do not `throw` in the application layer/,
  },
  {
    name: 'a repository that calls the database outside the failure mapper',
    mutate: (f) => {
      replaceIn(
        f,
        `${M}/infrastructure/prisma/prisma-item.repository.ts`,
        'findById(id: ItemId, tenantId: TenantId): AppResultAsync<Item | null, InfrastructureAppError> {',
        'findById(id: ItemId, tenantId: TenantId): AppResultAsync<Item | null, InfrastructureAppError> {\n    void db.orm.public.Item.first({ id });',
      );
    },
    lint: /\[architecture\/persistence-failures\] Database calls must run inside `fromThrowableAsync/,
  },
  {
    name: 'a Server Action that parses with Zod directly',
    mutate: (f) => {
      replaceIn(
        f,
        `${M}/presentation/actions/create-item-action.ts`,
        'Promise<ActionResult<ItemDto>> {\n',
        'Promise<ActionResult<ItemDto>> {\n  newItemSchema.safeParse(input);\n',
      );
    },
    lint: /\[architecture\/action-contract\] Do not call `\.safeParse\(\)` in an action/,
  },
  {
    name: 'a DTO that carries a Date',
    mutate: (f) => {
      replaceIn(
        f,
        `${M}/presentation/dto/item-dto.ts`,
        'readonly createdAt: string;',
        'readonly createdAt: Date;',
      );
    },
    lint: /\[architecture\/dto-serialization\] .*contains a `Date`/,
  },
  {
    name: 'a repository port without an adapter',
    mutate: (f) => {
      delete f[`${M}/infrastructure/prisma/prisma-item.repository.ts`];
      f[`${M}/composition.ts`] = f[`${M}/composition.ts`]!.replace(
        "import { PrismaItemRepository } from './infrastructure/prisma/prisma-item.repository';\n",
        '',
      ).replace('const items = new PrismaItemRepository();', 'const items = {} as never;');
    },
    tree: /\[module structure and capabilities\].*Repository port 'item\.repository\.ts' has no adapter/,
  },
  {
    name: 'a repository without a record mapper',
    mutate: (f) => {
      delete f[`${M}/infrastructure/prisma/item-record-mapper.ts`];
      f[`${M}/infrastructure/prisma/prisma-item.repository.ts`] = f[
        `${M}/infrastructure/prisma/prisma-item.repository.ts`
      ]!.replace(
        "import { ITEM_SELECT, toItem } from './item-record-mapper';",
        'const ITEM_SELECT = [] as const; const toItem = (x: never) => x;',
      );
    },
    tree: /\[module structure and capabilities\].*has no record mapper/,
  },
  {
    name: 'a missing translation in one locale',
    mutate: (f) => {
      f[`${M}/presentation/i18n/de.json`] = JSON.stringify({
        inventory: {
          fields: { name: 'Name' },
          actions: {},
          errors: { notFound: 'x', generic: 'y' },
          validation: { nameRequired: 'z' },
        },
      });
    },
    tree: /\[translation ownership\].*Missing key 'inventory\.actions\.create'/,
  },
  {
    name: 'a module whose translations are not registered with the locales',
    mutate: (f) => {
      f['src/i18n/locales/de.ts'] = 'const messages = {} as const;\n\nexport default messages;\n';
    },
    tree: /\[translation ownership\].*translations are not registered: import its 'de…' catalog from '@modules\/inventory'/,
  },
  {
    name: 'a public query that is not tagged as public',
    mutate: (f) => {
      replaceIn(
        f,
        `${M}/application/queries/get-public-item.ts`,
        / \*\n \* @authorization public[^\n]*\n/,
        '',
      );
    },
    tree: /\[authorization categories\].*is protected \(it has no `@authorization` tag\)/,
  },
  {
    name: 'a protected query that does not start with authorization',
    mutate: (f) => {
      replaceIn(
        f,
        `${M}/application/queries/get-item-by-id.ts`,
        "return loadAuthorizedItem(this.deps, id, 'inventory.read').map(({ item }) => toItemView(item));",
        "return this.deps.items.findById(id as never, 't' as never).map(() => ({}) as never);",
      );
    },
    lint: /\[architecture\/authorization-flow\] A protected use case must authorize before anything else/,
    tree: /\[authorization categories\].*does not start with authorization/,
  },
  {
    name: 'a deep import into another module from a component',
    mutate: (f) => {
      replaceIn(
        f,
        `${M}/presentation/components/create-item-form.tsx`,
        'import { createItemAction }',
        "import { x } from '@modules/auth/domain/models/ids';\nimport { createItemAction }",
      );
    },
    lint: /\[architecture\/no-cross-module-deep-imports\] Deep import into module 'auth'/,
    tree: /\[module graph \(deep imports, cycles\)\].*Deep import into module 'auth'/,
  },
  {
    name: 'a Client Component that reaches the composition root',
    mutate: (f) => {
      replaceIn(
        f,
        `${M}/presentation/components/create-item-form.tsx`,
        'import { createItemAction }',
        "import { inventoryQueries } from '../../composition';\nimport { createItemAction }",
      );
    },
    lint: /\[architecture\/layer-imports\] Client Components must not import server-only code/,
    tree: /\[client\/server boundary\]/,
  },
  {
    name: 'a public API that exposes a repository',
    mutate: (f) => {
      replaceIn(
        f,
        `${M}/index.ts`,
        'export { inventoryRoutes }',
        "export { PrismaItemRepository } from './infrastructure/prisma/prisma-item.repository';\nexport { inventoryRoutes }",
      );
    },
    lint: /\[architecture\/layer-imports\] .*must not be part of the module's public API/,
    tree: /\[public API\].*not an approved index\.ts source/,
  },
  {
    name: 'a folder outside the layer layout',
    mutate: (f) => {
      f[`${M}/domain/utils/slugify.ts`] = 'export const slugify = (s: string) => s;\n';
    },
    lint: /\[architecture\/module-structure\] 'domain\/utils\/' is not a valid folder name/,
  },
  {
    name: 'a placeholder file',
    mutate: (f) => {
      f[`${M}/domain/models/placeholder.ts`] = '// TODO\n';
    },
    tree: /\[module structure and capabilities\].*Empty file/,
  },
  {
    name: 'an error code that is user-facing prose',
    mutate: (f) => {
      replaceIn(
        f,
        `${M}/domain/errors/inventory-errors.ts`,
        "notFound: 'inventory.not_found'",
        "notFound: 'The item was not found.'",
      );
    },
    tree: /\[module structure and capabilities\].*must be a stable dotted identifier/,
  },
  {
    name: 'a branded id cast outside ids.ts',
    mutate: (f) => {
      replaceIn(
        f,
        `${M}/application/inventory-view-mappers.ts`,
        'id: item.id,',
        "id: 'x' as ItemId,",
      );
    },
    lint: /\[architecture\/branded-id-usage\] Do not cast to the branded id `ItemId`/,
  },
  {
    name: 'a hand-written internal route in an action',
    mutate: (f) => {
      replaceIn(
        f,
        `${M}/presentation/actions/create-item-action.ts`,
        'revalidatePath(inventoryRoutes.list());',
        "revalidatePath('/inventory');",
      );
    },
    lint: /\[architecture\/route-usage\] Do not hard-code an internal path/,
  },
  {
    name: 'a public use case that neither spends a rate-limit budget nor says why not',
    mutate: (f) => {
      replaceIn(
        f,
        `${M}/application/queries/get-public-item.ts`,
        / \* @rate-limit none [^\n]*\n/,
        '',
      );
    },
    lint: /\[architecture\/rate-limit-usage\] A public use case runs for anyone/,
  },
  {
    name: 'a rate-limit policy outside the module namespace',
    mutate: (f) => {
      withPolicy(f, { id: "'orders.create'" });
    },
    tree: /\[rate-limit policies\].*start with the module's name \('inventory\.'\)/,
  },
  {
    name: 'a rate-limit policy that fails open without a reviewed reason',
    mutate: (f) => {
      withPolicy(f, { onBackendFailure: "'allow'" });
    },
    tree: /\[rate-limit policies\].*fails open, which is a reviewed decision/,
  },
  {
    name: 'a rate-limit policy without an explicit failure mode',
    mutate: (f) => {
      withPolicy(f, { onBackendFailure: 'FAILURE_MODE' });
    },
    tree: /\[rate-limit policies\].*must say how it fails/,
  },
  {
    name: 'a client rate-limit policy that does not say what an unknown address means',
    mutate: (f) => {
      withPolicy(f, { id: "'inventory.create-client'" });
    },
    tree: /\[rate-limit policies\].*must say what happens when the address cannot be determined/,
  },
  {
    name: 'a rate-limit policy that no use case spends',
    mutate: (f) => {
      withPolicy(f, {}, { isSpent: false });
    },
    tree: /\[rate-limit policies\].*no use case or service of 'inventory' spends it/,
  },
  {
    name: "a rate-limit policy that reuses another policy's id",
    mutate: (f) => {
      withPolicy(f, { second: true });
    },
    tree: /\[rate-limit policies\].*reuses id 'inventory\.create'/,
  },
  {
    name: 'a module manifest with an invalid role',
    mutate: (f) => {
      f[`${M}/module.json`] = JSON.stringify({
        role: 'invalid-role',
        reason:
          'This is a long reason that explains why this manifest exists for testing purposes.',
      });
    },
    tree: /\[module manifests\].*Unknown module role 'invalid-role'/,
  },
];

describe('a new module that breaks a convention is rejected with an actionable diagnostic', () => {
  for (const mutation of mutations) {
    it(mutation.name, async () => {
      const root = tree(mutation.mutate);
      if (mutation.lint) {
        const messages = await lint(root);
        expect(messages.join('\n')).toMatch(mutation.lint);
      }
      if (mutation.tree) {
        const violations = runAllChecks(root).map(
          (v: { group: string; file: string; message: string }) =>
            `[${v.group}] ${v.file}: ${v.message}`,
        );
        expect(violations.join('\n')).toMatch(mutation.tree);
      }
    });
  }

  it('a cyclic dependency between two modules', () => {
    const files = standardModule();
    files['src/modules/billing/index.ts'] =
      "export { inventoryRoutes } from '@modules/inventory';\n";
    files[`${M}/presentation/routes.ts`] =
      "import { x } from '@modules/billing';\n\nexport const inventoryRoutes = { list: () => '/inventory' } as const;\n\nexport const y = x;\n";
    const violations = runAllChecks(makeTree(files)).map(
      (v: { group: string; message: string }) => `[${v.group}] ${v.message}`,
    );
    expect(violations.join('\n')).toMatch(
      /Cyclic module dependency: (?:inventory → billing → inventory|billing → inventory → billing)/,
    );
  });

  it('allows a fail-open rate-limit policy when accompanied by a valid @fail-open comment', () => {
    const root = tree((f) => {
      withPolicy(f, {
        onBackendFailure: "'allow'",
        failOpenComment: 'Brief outage is acceptable to avoid refusing service.',
      });
    });
    const violations = runAllChecks(root).filter(
      (v: { group: string }) => v.group === 'rate-limit policies',
    );
    expect(violations).toEqual([]);
  });
});

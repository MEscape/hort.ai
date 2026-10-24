/**
 * Central architecture policy.
 *
 * This file is the ONLY place that describes what the module architecture
 * allows. Both the ESLint plugin (`eslint/plugins/architecture`) and
 * the architecture tests (`__tests__/architecture`) read it, so a rule can
 * never drift from the test that double-checks it.
 *
 * Nothing in `eslint/` names a module, a table or a policy of the product. A standard business module needs no
 * declaration at all: it is governed by the defaults. A module that legitimately differs declares it itself in
 * `src/modules/<name>/module.json` (see `eslint/policy/manifest.mjs`), with a `reason`, so an exception sits next
 * to the code it excuses and is reviewed with it. Other exceptions are tags in the code (`@authorization`,
 * `@rate-limit none`, `@fail-open`, `@owner-scope`), each with a reason.
 */
import { readManifest } from './manifest.mjs';

export const LAYERS = /** @type {const} */ ([
  'domain',
  'application',
  'infrastructure',
  'presentation',
]);

/** Shared libraries (`@lib/<name>`) each layer may import. Anything else is reported. */
export const SHARED_LIB_ALLOW = {
  domain: ['errors', 'result', 'utils', 'pagination'],
  application: ['errors', 'result', 'utils', 'pagination'],
  infrastructure: ['errors', 'result', 'utils', 'logger', 'db', 'config', 'mail', 'pagination'],
  presentation: ['errors', 'result', 'utils', 'actions', 'seo', 'config', 'fonts', 'pagination'],
  // composition.ts, index.ts and module-root files: everything.
  root: null,
};

/**
 * Shared libraries that define a PORT shared by every module (`Clock`, `RateLimiter`, `ObjectStore`). Any layer
 * may `import type` the port; the implementation (`systemClock`, `getRateLimiter`, `getObjectStore`) is runtime state
 * and is wired by composition.ts only, so a runtime import from a layer is still reported.
 */
export const SHARED_PORT_LIBS = ['clock', 'rate-limit', 'storage'];

/** Packages that may never appear in a layer, regardless of how they are imported. */
export const FORBIDDEN_PACKAGES = {
  domain: [
    /^react($|\/)/,
    /^react-dom($|\/)/,
    /^next($|\/)/,
    /^next-intl($|\/)/,
    /^@prisma\//,
    /^react-hook-form$/,
  ],
  application: [
    /^react($|\/)/,
    /^react-dom($|\/)/,
    /^next($|\/)/,
    /^next-intl($|\/)/,
    /^@prisma\//,
    /^react-hook-form$/,
  ],
};

/** Layers that must never be reachable from a Client Component graph. */
export const SERVER_ONLY_SPECIFIERS = [
  /^server-only$/,
  /^next\/headers$/,
  /^@prisma\//,
  /^@lib\/db($|\/)/,
  /^@lib\/(config|mail|storage)\/server$/,
];

/**
 * Directories a layer may contain (first level below the layer folder).
 * `audit` is the home of audit adapters.
 */
export const LAYER_DIRS = {
  domain: ['errors', 'models', 'ports'],
  // `services` holds what a use case needs besides itself (parsing, loading context, deciding, mapping to views); data only through ports. Commands and queries call it, it never calls them (architecture/application-flow).
  application: ['commands', 'queries', 'contracts', 'services'],
  infrastructure: ['audit', 'prisma', 'provisioner'],
  presentation: ['actions', 'cache', 'components', 'dto', 'guards', 'i18n', 'messages', 'schemas'],
};

/**
 * Layers that may hold further sub-folders next to the conventional ones above.
 * Domain areas (`mapping`, `tree`, `rules`), technology adapters (`pg`, `cache`,
 * `connector`) and UI areas (`state`, `dnd`, `theme`) are open-ended by nature,
 * so they are allowed as long as the folder is named for what it contains.
 * `application` stays closed: it is the use-case surface and its shape is the contract.
 */
export const OPEN_LAYERS = ['domain', 'infrastructure', 'presentation'];

/** docs/rules/naming.md: names that say nothing. Rejected for module folders and files. */
export const GENERIC_NAMES = [
  'helper',
  'helpers',
  'misc',
  'common',
  'manager',
  'managers',
  'data',
  'shared',
  'util',
  'utils',
  'stuff',
  'temp',
  'tmp',
];

/** Files that may sit directly in a layer folder (no sub-folder). */
export const LAYER_ROOT_FILES = {
  domain: [],
  application: [
    /^[a-z0-9]+(?:-[a-z0-9]+)*-dependencies\.ts$/,
    /^[a-z0-9]+(?:-[a-z0-9]+)*-limits\.ts$/,
    /^[a-z0-9]+(?:-[a-z0-9]+)*-scope\.ts$/,
    /^[a-z0-9]+(?:-[a-z0-9]+)*-view-mappers\.ts$/,
    /^load-authorized-[a-z0-9]+(?:-[a-z0-9]+)*\.ts$/,
  ],
  infrastructure: [],
  presentation: [/^routes\.ts$/],
};

const KEBAB = '[a-z0-9]+(?:-[a-z0-9]+)*';

/**
 * File-name conventions per folder. A file inside one of these folders that
 * matches none of the patterns is reported by `architecture/module-structure`
 * with the list of accepted shapes. `null` means "any kebab-case file".
 */
export const DIR_FILE_PATTERNS = {
  'domain/errors': [new RegExp(`^${KEBAB}-errors\\.ts$`)],
  'domain/models': null,
  'domain/ports': [new RegExp(`^${KEBAB}\\.(?:port|repository)\\.ts$`)],
  'application/commands': null,
  'application/queries': null,
  // What a contract holds: validation limits, read shapes, request shapes, the editor/session model, a stored snapshot
  // and the cache tags that name what a read depends on. One file per kind, named `<name>-<kind>.ts`.
  'application/contracts': [
    new RegExp(`^${KEBAB}-(?:constraints|views|inputs|model|snapshot|tags)\\.ts$`),
  ],
  'infrastructure/prisma': [
    new RegExp(`^${KEBAB}\\.repository\\.ts$`),
    new RegExp(`^${KEBAB}-record-mapper\\.ts$`),
    // Owner-scoped starting points shared by repositories (a relation filter, not a repository).
    new RegExp(`^${KEBAB}-ownership\\.ts$`),
  ],
  'infrastructure/audit': [new RegExp(`^${KEBAB}-audit-log\\.ts$`)],
  'infrastructure/provisioner': [new RegExp(`^${KEBAB}-provisioner\\.ts$`)],
  'presentation/actions': [new RegExp(`^${KEBAB}-action\\.ts$`)],
  'presentation/dto': [new RegExp(`^${KEBAB}-dto\\.ts$`)],
  'presentation/schemas': [
    new RegExp(`^${KEBAB}-schema\\.ts$`),
    new RegExp(`^parse-${KEBAB}-input\\.ts$`),
  ],
  'presentation/messages': [/^message-keys\.ts$/],
  'presentation/components': null,
  // <locale>.json holds the text; the module's public API exposes it as en<Module>/de<Module> for src/i18n/locales
  // (directly from the JSON, or through an optional catalog.ts).
  'presentation/i18n': [/^[a-z]{2}(?:-[A-Z]{2})?\.json$/, /^catalog\.ts$/],
  'presentation/guards': null,
  'presentation/cache': null,
  'application/services': null,
};

/** Module-root files every module may contain. */
export const MODULE_ROOT_FILES = ['index.ts', 'client.ts', 'composition.ts'];

/**
 * Module roles. A role switches whole convention groups on or off; it never
 * names a file. Only two roles exist; a module that needs a third one is a
 * signal to discuss the architecture, not to add an exception. A module picks its role in its own
 * `module.json`; without one it is `business`.
 *
 *  - `business`: the standard module. Commands/queries, a composition.ts,
 *    audited commands, record-mapped repositories.
 *  - `platform`: infrastructure-heavy cross-cutting module (authentication).
 *    Its composition root lives in infrastructure and its public API may
 *    expose the factory of that root. What it protects (sign-in, identity) never lets a request through
 *    uncounted when the rate limiter's store is down.
 */
export const ROLES = {
  business: {
    compositionFile: 'composition.ts',
    requireComposition: true,
    commandsRequireAudit: true,
    repositoriesRequireRecordMapper: true,
    /** A rate-limit policy of this module may fail open when it carries `@fail-open <reason>`. */
    rateLimitsMayFailOpen: true,
    /** `type XId = Brand<..>` requires both `toXId` (stored) and `parseXId` (request). */
    brandParsersRequired: true,
    /**
     * Where `index.ts` (the server-capable entry) may re-export from. Stable error codes, branded ids,
     * contracts, use cases (for cross-module orchestration through an adapter) and presentation are
     * public; infrastructure, repositories and record mappers never are.
     */
    publicApiSources: [
      'composition',
      'application/contracts/',
      'application/commands/',
      'application/queries/',
      'domain/errors/',
      'domain/models/ids',
      'presentation/',
    ],
    /** Where `client.ts` (the browser-safe entry) may re-export from: nothing that reaches the server. */
    clientApiSources: [
      'application/contracts/',
      'domain/errors/',
      'domain/models/ids',
      'presentation/actions/',
      'presentation/components/',
      'presentation/dto/',
      'presentation/routes',
      'presentation/schemas/',
    ],
  },
  platform: {
    compositionFile: 'composition.ts',
    requireComposition: true,
    commandsRequireAudit: true,
    repositoriesRequireRecordMapper: false,
    rateLimitsMayFailOpen: false,
    // Identity ids are minted by the identity provider / membership lookup; no request ever supplies one.
    brandParsersRequired: false,
    publicApiSources: [
      'composition',
      'domain/models/',
      'domain/errors/',
      'application/authorization-service',
      'application/contracts/',
      'application/commands/',
      'application/queries/',
      'presentation/',
    ],
    clientApiSources: [
      'application/contracts/',
      'domain/errors/',
      'domain/models/ids',
      'presentation/actions/',
      'presentation/components/',
      'presentation/dto/',
      'presentation/routes',
      'presentation/schemas/',
    ],
  },
};

/**
 * Module cycles that exist today, identified by the SET of modules on the cycle. A cycle not listed here fails the
 * architecture checks; a listed cycle that no longer exists fails them too ("remove it"), so the list only shrinks.
 *
 * Empty today. Add `{ modules: ['a', 'b'], reason: '…' }` only for a cycle you cannot break in the same change.
 *
 * @type {{ modules: string[], reason: string }[]}
 */
export const KNOWN_MODULE_CYCLES = [];

/**
 * Cross-module imports in infrastructure that are allowed in repository /
 * record-mapper files: trusted brand constructors (`toXId`) are the
 * documented way to brand a stored value; they are not an integration call.
 */
export const TRUSTED_BRAND_CONSTRUCTOR = /^to[A-Z][A-Za-z0-9]*Id$/;

/**
 * The locale *identifier* is shared vocabulary, not translation: layers other than
 * presentation may reference these names from '@i18n' (translation functions stay forbidden).
 */
export const I18N_VOCABULARY_ALLOW = ['Locale'];
/** Infrastructure that renders per-locale output (e-mail) may also read the locale context. */
export const I18N_INFRASTRUCTURE_ALLOW = ['Locale', 'I18N_CONFIG', 'getLocale'];

/** Domain identifiers: `type XId = Brand<string, 'XId'>` requires `toXId` and `parseXId`. */
export const BRAND_TYPE_NAME = /^[A-Z][A-Za-z0-9]*Id$/;

/** Hard-coded query bound names the `limits-usage` rule treats as limits. */
export const LIMIT_NAME_PATTERN =
  /(?:^|_)(?:LIMIT|PAGE_SIZE|TAKE|BATCH_SIZE|MAX_(?:ITEMS|ROWS|RESULTS|PER_PAGE)|MIN_LIST|MAX_LIST|DEFAULT_LIST)(?:$|_)/;

/**
 * Returns the effective, merged policy for one module: its role's defaults, plus whatever its own `module.json`
 * declares. `root` is the repository root (a fixture tree in tests).
 */
export function policyFor(moduleName, root = process.cwd()) {
  const manifest = readManifest(moduleName, root);
  const roleName = manifest?.role ?? 'business';
  const role = ROLES[roleName] ?? ROLES.business;
  return {
    module: moduleName,
    roleName,
    role,
    reason: manifest?.reason ?? null,
    compositionFile: manifest?.compositionFile ?? role.compositionFile,
    publicApiSources: role.publicApiSources,
    clientApiSources: role.clientApiSources,
    extraDirs: manifest?.extraDirs ?? {},
    extraRootFiles: manifest?.extraRootFiles ?? {},
    /**
     * Pure, side-effect-free exports of THIS module that another module's domain/application code may call at
     * runtime (a predicate over a value, no I/O, no state). Anything else a use case needs from a module goes
     * through an infrastructure adapter behind a domain port.
     */
    runtimeExports: manifest?.runtimeExports ?? [],
  };
}

/**
 * What protects unsaved work is found by name, not listed: a hook whose name says it guards against losing
 * unsaved changes or leaving the page (`useReportUnsavedChanges`, `useBeforeUnloadGuard`, …). A react-hook-form
 * form in module presentation calls one or says why not with `@unsaved-work none <reason>`
 * (`architecture/unsaved-work-guard`). `__tests__/architecture/policy-consistency.test.ts` checks that at least
 * one such hook exists when a form needs it; explicit credential-form opt-outs need no guard.
 */
export const UNSAVED_WORK_GUARD = /^use\w*(?:Unsaved|BeforeUnload)\w*$/;

/**
 * Route files that are Server Components by definition: they compose, they are not the interactive leaf
 * (docs/rules/nextjs.md). Error boundaries must be client components and are not listed.
 */
export const SERVER_ONLY_ROUTE_FILES =
  /^(?:page|layout|template|default|not-found|loading|route)\.tsx?$/;

/**
 * Rate limiting. A module declares its budgets as plain data in
 * `application/rate-limits.ts`; use cases spend them. `architecture/rate-limit-usage` checks the shape of
 * that file and who may call the limiter; `__tests__/architecture/rate-limit-policies.test.ts` checks the
 * policies themselves across modules.
 *
 * A policy fails closed (`onBackendFailure: 'deny'`) unless it says otherwise. Letting a request through,
 * uncounted, when the limiter's store is down (`'allow'`) is a reviewed decision: the policy carries a
 * `// @fail-open <reason>` comment (what makes a short gap in protection cheaper than refusing the people the
 * operation serves), and the module's role must allow it (`ROLES.<role>.rateLimitsMayFailOpen`).
 */
export const RATE_LIMIT_POLICIES = {
  /** The file of policy data inside a module's application layer. */
  file: 'rate-limits.ts',
  /** The export name: `<NAME>_RATE_LIMITS`. */
  exportName: /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_RATE_LIMITS$/,
  /** What the export must satisfy, so a policy missing a field does not compile. */
  type: 'Record<string, RateLimitPolicy>',
  /** The only things that file may import: time constants and (as a type) the policy type. */
  allowedImports: ['@lib/utils', '@lib/rate-limit'],
  /** The comment on a fail-open policy, with its reason. */
  failOpenTag: /@fail-open\s+\S/,
};

/**
 * Ownership of stored data: which rows belong to whom. A product that isolates data between owners (tenants,
 * accounts, child profiles) names the columns that tie a row to its owner; a product that does not leaves the
 * list empty and `architecture/owner-scope` stays dormant.
 *
 * Nothing else is listed. The tables that are owned, the columns that pin each one and the parent a child table
 * is owned through are DERIVED from the Prisma contract (`eslint/policy/ownership.mjs`), so a new table is
 * covered the moment it has an owner column or a foreign key to an owned table.
 *
 * - `columns`: a query that constrains one of these columns by equality is bound to ONE owner. A table that
 *   refuses any row whose column differs from its own `id` (`CHECK ("id" = "<column>")`) is its own owner, and
 *   its `id` pins it too.
 * - `tag`: why a query may not be pinned, stated on the statement, the method or the helper as
 *   `@<tag> <kind> <reason>` (kinds in `OWNER_SCOPE_KINDS`).
 * - `contractFile`: the Prisma contract the tables are read from.
 */
export const OWNERSHIP = {
  columns: /** @type {string[]} */ (['ownerId']),
  tag: 'owner-scope',
  contractFile: 'src/lib/db/contract.json',
};

/**
 * Why a query on an owned table may not be pinned to its owner. Each kind is a different argument for why
 * nothing leaks; a query that fits none is pinned, not tagged.
 */
export const OWNER_SCOPE_KINDS = {
  /** The ids come from a read or write in the same method that was pinned; the rows are that owner's. */
  derived: 'ids from an earlier pinned read or write',
  /** A row of a parent that is itself pinned, reached through the parent's key. */
  child: 'rows of a parent that is pinned',
  /** Bound to the signed-in person's own id, not to an owner: "my memberships". */
  actor: "bound to the person's own id",
  /** Deliberately across owners, for a platform-wide job or administrator; the use case authorizes that. */
  platform: 'across every owner, for a platform-wide job or administrator',
  /** Reached by an unguessable single-use secret or a public identifier. */
  capability: 'reached by a secret or a public identifier',
  /** A starting point that callers extend; the callers pin it or tag themselves. */
  builder: 'a query builder the callers pin',
};

/**
 * The vocabulary of the authorization service every protected use case starts from
 * (`architecture/authorization-flow`). These are the names of ITS methods and of the actor property a load is
 * keyed by; when the service is renamed, this is the one place to follow it.
 * `__tests__/architecture/policy-consistency.test.ts` checks the service really declares them.
 */
export const AUTHORIZATION = {
  /** Authorizes the signed-in actor for a permission and returns the actor. */
  actorCall: 'requireInTenant',
  /** Authorizes the actor for a permission on one loaded resource's scope. */
  resourceCall: 'requireOnResource',
  /** The property of the actor a load is keyed by (`repository.find(id, actor.<ownerKey>)`). */
  ownerKey: 'tenantId',
};

/**
 * docs/rules/react.md: a component draws what it is given. `maxStatements` is how many things it may do before
 * its `return` besides calling hooks of its own; `countedHooks` are React's state and effect hooks, which are
 * things it does (a call to a hook of ours is composition and is free).
 */
export const COMPONENT_LOGIC = {
  maxStatements: 5,
  countedHooks: [
    'useState',
    'useReducer',
    'useEffect',
    'useLayoutEffect',
    'useMemo',
    'useCallback',
  ],
};

/** Where components live: module presentation, and the shared kit except the primitives in `ui`. */
export function componentLogicScope(file) {
  if (file.area === 'module') return file.layer === 'presentation' && file.dir === 'components';
  return file.area === 'components' && !file.path.startsWith('src/components/ui/');
}

/**
 * docs/rules/code-style.md: files stay small enough to read in one go. `default` is the most code lines (no
 * blanks, no comments) any file may have; `focused` is the lower limit for application and component
 * code, where small files are the convention. A file that is long because it is a flat table says so with
 * an `eslint-disable max-lines -- <why>` and `eslint-enable max-lines` block comment pair around it.
 */
export const FILE_SIZE = {
  default: 300,
  focused: 200,
};

/**
 * docs/rules/modules.md: a command or query keeps its own file short. Past `max` local helpers (functions
 * beside the class, and methods besides `execute`) the helpers are a service in `application/services`.
 */
export const USE_CASE_HELPERS = {
  max: 3,
};

/** The files `FILE_SIZE.focused` applies to. */
export const FOCUSED_SIZE_GLOBS = [
  'src/modules/*/application/**/*.{ts,tsx}',
  'src/modules/*/presentation/components/**/*.{ts,tsx}',
  'src/components/**/*.{ts,tsx}',
];

/**
 * docs/rules/styling.md: the design system is used where it fits. `plain` maps a raw element to what to use
 * instead; `pairs` names a primitive that is framed by a composite (importing `source` calls for importing
 * `needs`). A file that has a reason for plain markup says so with `// @ui-plain <name> <reason>`, where `name`
 * is the element or the pair's `name`. Components in `src/components` are the design system and are not checked.
 */
export const UI_COMPOSITION = {
  plain: {
    button: {
      use: "`Button` from '@components/ui/button'",
      why: 'consistent focus, disabled and loading behavior',
    },
    select: {
      use: "`Select` from '@components/ui/select', or `SelectField` / `FilterSelect` from '@components/shared'",
    },
    a: {
      use: "the locale-aware `Link` from '@i18n' for app navigation, or `ContentLink` from '@components/ui/content-link' for a target that comes from content",
    },
    table: {
      use: "the `Table` parts from '@components/ui/table'",
      why: 'one look for every table',
    },
    input: {
      use: "`Input` from '@components/ui/input', or `TextField` from '@components/shared/text-field' when it needs a label, hint and error",
    },
    textarea: { use: "`Textarea` from '@components/ui/input'" },
    label: { use: "`Label` from '@components/ui/input', or a field from '@components/shared'" },
  },
  pairs: [
    {
      name: 'table',
      source: '@components/ui/table',
      needs: '@components/shared/data-panel',
      hint: 'A table that is the subject of a screen sits in a DataPanel (title, actions, footer), so every list is framed the same.',
    },
    {
      name: 'list-pagination',
      source: '@components/shared/list-pagination',
      needs: '@components/shared/data-panel',
      hint: 'ListPagination goes in the footer of a DataPanel.',
    },
  ],
};

/** Module presentation and the app's routes are checked; `src/components` is the design system itself. */
export function uiCompositionScope(file) {
  return (file.area === 'module' && file.layer === 'presentation') || file.area === 'app';
}

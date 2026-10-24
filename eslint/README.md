# ESLint setup

`eslint.config.mjs` only composes the blocks below, in order (later blocks win per rule key; Prettier comes next to last).

```text
eslint/
├── config/            flat-config blocks, one concern each
│   ├── globs.mjs        file groups (tests, config files, framework files, generated files)
│   ├── selectors.mjs    `no-restricted-syntax` selector fragments (process.env, raw HTML, clock, Intl…)
│   ├── base · typescript · imports · naming · style · react · tokens
│   ├── restrictions.mjs package, global and syntax restrictions per layer
│   ├── architecture.mjs turns the `architecture/*` rules on
│   └── overrides.mjs    tests, framework files, tooling (last, so it can relax)
├── policy/            the ONE architecture policy: layers, roles, allow-lists, module checks
│   ├── policy.mjs       read by the plugin rules and by `__tests__/architecture`
│   ├── manifest.mjs     loads and validates per-module `module.json` manifests
│   ├── ownership.mjs    neutral ownership contract and schema-derived owner scope
│   └── checks-*.mjs     pure architecture check functions
├── plugins/
│   ├── architecture/    custom `architecture/*` rules
│   │   ├── util.mjs       rule helpers (`defineRule`, `report`, `classifyContext`)
│   │   └── rules/<group>/<rule>.mjs
│   └── design-tokens.mjs  design-token conformance (derived from CSS variables)
└── shims.d.ts         lets the TypeScript tests import the untyped `.mjs`
```

Rule groups (`rules/`): `boundaries` (who may import or declare what), `structure` (module shape and public API), `use-cases` (commands, queries, the direction of calls inside `application`, authorization, rate limits), `adapters` (repositories, audit), `presentation` (actions, DTOs, forms, messages, routes, what a component may do), `pages` (metadata, headings). Tests mirror them in `__tests__/eslint/`.

## Adding a rule

1. Write `plugins/architecture/rules/<group>/<name>.mjs` with `defineRule`; derive scope from `classifyContext`, never name a module. Everything is syntactic (no type checker).
2. Register it in `plugins/architecture/index.mjs` and switch it on in `config/architecture.mjs`.
3. Put any list it needs (allowed names, patterns) in `policy/policy.mjs`.
4. Add a `RuleTester` case, valid and invalid, to the group's test file.
5. If it enforces a written rule, name the rule file in the message; if it adds a rule, update `docs/rules/` and `AI_RULES.md`.

A syntax-only ban (a global, a JSX attribute) is a selector in `config/selectors.mjs`. ESLint keeps only the last `no-restricted-syntax` value per file, so every block spreads `...EVERYWHERE` and then its own selectors. Never add a second block for an overlapping glob.

## Rules that ask for a stated reason, never for a workaround

A rule that cannot know intent accepts a one-line reason instead of blocking the feature:

| Rule                                 | What it asks                                                                                                 | Opt out with                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `architecture/unsaved-work-guard`    | A `useForm` form in module components uses an unsaved work guard hook.                                       | `// @unsaved-work none <reason>`                         |
| `architecture/authorization-flow`    | A use case authorizes, or is tagged public/system.                                                           | `@authorization <category> <reason>`                     |
| `architecture/owner-scope`           | A query on an owner-scoped table (or raw SQL naming one) is bound to its owner in `.where(…)` / `create(…)`. | `@owner-scope <kind> <reason>` (kinds in `policy.mjs`)   |
| `architecture/rate-limit-usage`      | A public use case spends a rate-limit budget from `application/rate-limits.ts`.                              | `@rate-limit none <reason>`                              |
| `architecture/rate-limit-opt-outs`   | A rate limit in `application/rate-limits.ts` with `mayFailOpen: true` is tagged (module role must allow it). | `// @fail-open <reason>`                                 |
| raw HTML (`dangerouslySetInnerHTML`) | Content is rendered as text or components.                                                                   | `// eslint-disable-next-line … -- <how it is sanitized>` |

Every `eslint-disable` needs a description (`eslint-comments/require-description`).

## Size, reuse and logic in components

These limits keep the code small and consistent without asking anyone to work around them. They apply to all of `src`, every module alike, and read their numbers from `policy/policy.mjs`. A file that breaks one is reported until it is fixed; nothing is exempted by name.

| Limit                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Where                                                                | Enforced by                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------- |
| At most 300 code lines per file (200 in `application` and in components); blank lines and comments do not count                                                                                                                                                                                                                                                                                                                                                                  | `FILE_SIZE`                                                          | `max-lines` in `config/style.mjs` |
| A component does at most 5 things before its `return` besides calling hooks of its own: derived values, handlers, React's `useState`/`useEffect`/`useMemo`/`useCallback`                                                                                                                                                                                                                                                                                                         | `COMPONENT_LOGIC`                                                    | `architecture/component-logic`    |
| A command or query has at most 3 local helpers; more become a service in `application/services`                                                                                                                                                                                                                                                                                                                                                                                  | `USE_CASE_HELPERS`                                                   | `architecture/use-case-helpers`   |
| `application/services` never imports a command or query; a query never imports a command                                                                                                                                                                                                                                                                                                                                                                                         | `rules/use-cases/application-flow.mjs`                               | `architecture/application-flow`   |
| What `@lib/utils` and `@lib/pagination` already do is imported: a local function or constant named like a utils export (read from the library), a time constant in milliseconds, `filter(x => x !== null)`, `[...new Set(x)]`, `Math.min(…Math.max(…))`, `s.trim() === ''`, `filter((_, i) => i !== n)`, `map((x, i) => i === n ? v : x)`, `Object.fromEntries(Object.entries(o).filter(…))`, `new URLSearchParams({…})`, `(page - 1) * pageSize`, `Math.ceil(total / pageSize)` | `LIB_DUPLICATES` in `config/selectors.mjs`, `config/lib-exports.mjs` | `no-restricted-syntax`            |
| The design system is used where it fits: a raw `<button>`, `<select>`, `<a>`, `<table>`, `<input>`, `<textarea>` or `<label>`, and `Table` or `ListPagination` without a `DataPanel`, are reported unless the file says `// @ui-plain <name> <reason>`                                                                                                                                                                                                                           | `UI_COMPOSITION`                                                     | `architecture/ui-composition`     |

Lint runs with `--max-warnings 0`, so a warning fails like an error.

A file that is long because it is a flat table says so with a `/* eslint-disable max-lines -- <why> */` … `/* eslint-enable max-lines */` pair around it (`eslint-comments/disable-enable-pair` does not allow an unpaired file-wide disable).

**Plain markup is a choice that is written down.** `architecture/ui-composition` is the rule for "use the design system where it fits". It never blocks: a file that has a reason for a raw `<button>` (a drag handle with its own focus ring), a radio card, or a table that is one row of a panel the parent draws says so in a comment, `// @ui-plain <name> <reason>`, and the rule is satisfied. The reason is what review sees. Add a pair to `UI_COMPOSITION.pairs` when a primitive always belongs in a frame; add an element to `UI_COMPOSITION.plain` when a component for it exists.

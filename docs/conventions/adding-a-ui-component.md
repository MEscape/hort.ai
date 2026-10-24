# Adding a UI Component

Owning rules: [`react.md`](../rules/react.md), [`styling.md`](../rules/styling.md), [`accessibility.md`](../rules/accessibility.md), [`i18n.md`](../rules/i18n.md), [`naming.md`](../rules/naming.md).

Generator: `npm run gen -- component <name> [-m <module>] [--client]` ([`scripts/README.md`](../../scripts/README.md)).

## Checklist

1. Decide where the component belongs. Use shared UI when it has no knowledge of a specific module; otherwise, put it in `presentation/components/` in the owning module. See [`modules.md`](../rules/modules.md).
2. Check for an existing primitive and compose it instead of creating another one. Examples include `Button`, `Table`, `Input`, `DataPanel`, and `TextField`. Start with [`src/components/README.md`](../../src/components/README.md). If plain markup must replace an existing primitive, document the reason in the file using `// @ui-plain <name> <reason>`. See [`styling.md`](../rules/styling.md).
3. Default to a Server Component. Add `use client` only when state, effects, event handlers, or browser APIs require it. Keep the client boundary as small as possible. See [`react.md`](../rules/react.md).
4. Name the file in `kebab-case` and the component in `PascalCase`. See [`naming.md`](../rules/naming.md).
5. Keep component logic small. A component may perform at most five things itself; lint counts derived values, handlers, and React's own hooks. Beyond that, move state, effects, derived values, and handlers into a hook named `use-*.ts` in the module's `presentation/hooks/` or in `src/hooks/`. Split components that exceed the size limit into parts named for what they render. See [`react.md`](../rules/react.md) and [`code-style.md`](../rules/code-style.md).
6. Style with design tokens. Do not use inline styles for static values or arbitrary values where a token exists.
7. Define component variants explicitly and type them.
8. Source user-facing text from translations; do not hard-code strings. See [`i18n.md`](../rules/i18n.md).
9. Use semantic HTML, give interactive elements accessible names, and support keyboard interaction. See [`accessibility.md`](../rules/accessibility.md).
10. Handle loading, empty, and error states where applicable.
11. Test observable behavior through user interaction. Prefer queries by role and accessible name.

## Scaffolding

`npm run gen -- component <name> [-m <module>] [--client]` creates the component and a render test in the appropriate location.

The generated markup is a placeholder. Compose existing primitives, use design tokens, and provide translations as described above.

See [`scripts/README.md`](../../scripts/README.md).

## Done when

- [ ] No required user-facing text is hard-coded.
- [ ] The component supports keyboard-only interaction.
- [ ] Styling uses design tokens rather than raw visual values.
- [ ] The client boundary is as small as possible.
- [ ] The component performs at most five things itself, excluding hook calls and returning markup.
- [ ] Loading, empty, and error states are handled where applicable.
- [ ] Tests cover meaningful user interactions and accessible behavior.

# React Rules

- Keep components focused on presentation and interaction; keep business logic outside them.
- Components render supplied data. Small local logic is allowed: one useState, a derived value, and a handler.
- Beyond calling hooks and returning markup, a component may declare at most five items total: derived values, handlers, and React useState/useEffect/useMemo/useCallback calls. Move larger logic into a use-*.ts hook. Design-system primitives in src/components/ui are exempt. Lint enforces architecture/component-logic.
- Keep Client Components small and close to interactive UI. See [nextjs.md](nextjs.md).
- Do not move a parent to the client to support one interactive child.
- Prefer local state; lift it only when multiple components need it.
- Derive values instead of duplicating state.
- Use refs for mutable values that should not trigger renders or for DOM access.
- Do not use useEffect for derived state or ordinary data fetching; use effects to synchronize with external systems.
- Do not add client-side fetching libraries for data Server Components can load directly.
- Prefer React's automatic optimization. Use memoization only for demonstrated performance needs or API requirements.
- Expose accessible names and states. See [accessibility.md](accessibility.md).
- Prefer composition over deeply configurable components.
- Follow [naming.md](naming.md) for component names.
- Forms that edit persistent data must protect unsaved work or state @unsaved-work none <reason>.

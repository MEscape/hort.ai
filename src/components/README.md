# Shared components (`@components`)

UI that more than one module uses. It is generic (no business owner, no domain concept) and never imports a module. Before adding a component, check this index; update it in the same change (`docs/conventions/adding-a-ui-component.md`).

## Layout

| Folder       | What belongs there                                                                            | Exists  |
| ------------ | --------------------------------------------------------------------------------------------- | ------- |
| `ui/`        | Design-system primitives, compatible with the shadcn workflow configured in `components.json` | yes     |
| `layout/`    | Page-level building blocks that hold no business content                                      | not yet |
| `shared/`    | Composites built from primitives (`gen component`)                                            | yes     |
| `providers/` | React context providers wired once in a layout                                                | yes     |

Create a folder with its first component; do not add empty ones.

## Available

- `ui/button.tsx` (`Button`): `primary`, `secondary`, `accent`, `outline`, `ghost` variants; `sm`, `default`, `lg`, `icon` sizes. Defaults to a non-submitting native button. Built using existing tokens, without adding a new package.
- `ui/card.tsx` (`Card`): visual panel with `surface`, `sunken`, `highlight` tones; cards are not inherently clickable.
- `shared/feedback-panel.tsx` (`FeedbackPanel`): accessible child-friendly feedback treatment using `success`, `nudge`, and `hint` tones; uses text and symbols, never color alone.
- `providers/i18n-provider.tsx` (`I18nProvider`, server): loads the request locale's messages for the namespaces a subtree declares and hands them to the client provider.
- `providers/i18n-client-provider.tsx` (`I18nClientProvider`, client): the `next-intl` client provider; Client Components receive only the namespaces their subtree declared.

The living gallery and component documentation are in [`docs/design-system/`](../../docs/design-system/README.md) and at `/en/design-system` / `/de/design-system`. Gallery specimens are _not_ business modules or authoritative lesson implementations.

## Expected by the rules, not written yet

`RouteErrorPanel` and `NotFoundPanel` (`shared/`): translated, theme-aware panels that `error.tsx` and `not-found.tsx` render (`docs/rules/nextjs.md`), using `app.routeError.*` and `app.notFound.*` messages. Write them with the first route that needs them.

Complex shadcn components such as Dialog are not installed yet. Add them using the repository's existing shadcn CLI; review any generated dependencies and refit default styles to Hort.ai's tokens.

## Conventions

- Files are kebab-case, one primary export per file, named exports.
- Components hold at most a little logic (`docs/rules/react.md`); state and effects live in a `use-*.ts` hook when needed.
- Styling uses the design tokens in `src/app/globals.css` (`--hortai-*`) through Tailwind; no hard-coded colors.
- Text comes from translations; an icon-only control has an accessible name.

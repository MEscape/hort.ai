# Shared components (`@components`)

UI that more than one module uses. It is generic (no business owner, no domain concept) and never imports a module. Before adding a component, check this index; update it in the same change (`docs/conventions/adding-a-ui-component.md`).

## Layout

| Folder       | What belongs there                                                                          | Exists  |
| ------------ | ------------------------------------------------------------------------------------------- | ------- |
| `ui/`        | Design-system primitives (shadcn: `npx shadcn add <name>`, configured in `components.json`) | yes     |
| `layout/`    | Page-level building blocks that hold no business content                                    | not yet |
| `shared/`    | Composites built from primitives (`gen component`): panels, pagination, forms controls      | yes     |
| `providers/` | React context providers wired once in a layout                                              | yes     |

Create a folder with its first component; do not add empty ones.

## Available

- `ui/button.tsx` (`Button`, shadcn): `default`, `accent`, `secondary`, `outline`, `ghost`, `link`, `danger` variants; `sm`, `default`, `lg`, `icon`, `icon-sm` sizes; `asChild` renders a link with the button look. Set `type` explicitly inside forms.
- `ui/card.tsx` (`Card`, `CardHeader`, `CardContent`, `CardFooter`, shadcn): visual panel with `surface` (default), `sunken`, `highlight` tones; cards are not inherently clickable.
- `shared/feedback-panel.tsx` (`FeedbackPanel`): accessible child-friendly feedback treatment using `success`, `nudge`, and `hint` tones; uses text and symbols, never color alone.
- `providers/i18n-provider.tsx` (`I18nProvider`, server): loads the request locale's messages for the namespaces a subtree declares and hands them to the client provider.
- `providers/i18n-client-provider.tsx` (`I18nClientProvider`, client): the `next-intl` client provider; Client Components receive only the namespaces their subtree declared.

## Authentication UI building blocks

`RouteErrorPanel` and `NotFoundPanel` (`shared/`): the translated, theme-aware panels that every `error.tsx` and `not-found.tsx` renders (`docs/rules/nextjs.md`), using the `app.routeError.*` and `app.notFound.*` messages. They are used by the authentication and locale route boundaries.

## Design-system gallery

The living gallery and component documentation are in [`docs/design-system/`](../../docs/design-system/README.md) and at `/en/design-system` / `/de/design-system`. Gallery specimens are _not_ business modules or authoritative lesson implementations.

Complex shadcn components such as Dialog are not installed yet. Add them using the repository's existing shadcn CLI; review any generated dependencies and refit default styles to Hort.ai's tokens.

## Conventions

- Files are kebab-case, one primary export per file, named exports.
- Components hold at most a little logic (`docs/rules/react.md`); state and effects live in a `use-*.ts` hook when needed.
- Styling uses the design tokens in `src/app/globals.css` (`--hortai-*`) through Tailwind; no hard-coded colors.
- Text comes from translations; an icon-only control has an accessible name.

- `ui/`: token-styled shadcn `Button`, `Input`, `Label`, `Alert`, `Card`, and `Skeleton`. Curated Lucide icons are exported by `ui/icons.tsx`.
- `brand/`: `HortaiLogo`, the five-mood owl companion `Hort`, and the decorative warm-paper landscape `WorldScene`. Hort references the canonical artwork in `public/brand/owl.svg`; `npm run brand:generate` exports matching icons and email assets. Interface colors come from semantic tokens; ambient motion respects calm mode and the OS preference. See [branding](../../docs/architecture/branding.md).
- `shared/`: `TextField` associates labels, hints and errors; `PasswordField` adds visibility and Caps Lock feedback; `FieldMessage` supplies consistent field feedback. `RouteErrorPanel` and `NotFoundPanel` provide translated recovery states.
- `src/hooks/`: `usePasswordField`, `useCountdown` and `useFocusOnMount` hold reusable browser interaction state.

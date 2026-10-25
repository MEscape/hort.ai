# Shared components (`@components`)

UI that more than one module uses. It is generic (no business owner, no domain concept) and never imports a module. Before adding a component, check this index; update it in the same change (`docs/conventions/adding-a-ui-component.md`).

## Layout

| Folder       | What belongs there                                                                          | Exists |
| ------------ | ------------------------------------------------------------------------------------------- | ------ |
| `ui/`        | Design-system primitives (shadcn: `npx shadcn add <name>`, configured in `components.json`) | yes    |
| `layout/`    | Page-level building blocks that hold no business content                                    | yes    |
| `shared/`    | Composites built from primitives (`gen component`): panels, pagination, forms controls      | yes    |
| `providers/` | React context providers wired once in a layout                                              | yes    |

Create a folder with its first component; do not add empty ones.

## Available

- `layout/layout-primitives.tsx`: the page frame. `PageShell` (window-high column, stacking context for the `WorldScene`), `PageHeader` (the banner with the logo) and `PageMain` (the one `<main>`; `panel` = a card in a reading-width column with room for Hort on its edge, `centered` = a lone panel such as an error). `AuthShell` and the `error.tsx` files compose them. Add a primitive here when a second screen needs it, not before.
- `providers/i18n-provider.tsx` (`I18nProvider`, server): loads the request locale's messages for the namespaces a subtree declares and hands them to the client provider.
- `providers/i18n-client-provider.tsx` (`I18nClientProvider`, client): the `next-intl` client provider; Client Components receive only the namespaces their subtree declared.

## Authentication UI building blocks

`RouteErrorPanel` and `NotFoundPanel` (`shared/`): the translated, theme-aware panels that every `error.tsx` and `not-found.tsx` renders (`docs/rules/nextjs.md`), using the `app.routeError.*` and `app.notFound.*` messages. They are used by the authentication and locale route boundaries.

## Conventions

- Files are kebab-case, one primary export per file, named exports.
- Components hold at most a little logic (`docs/rules/react.md`); state and effects live in a `use-*.ts` hook.
- Styling uses the design tokens in `src/app/globals.css` (`--hortai-*`) through Tailwind; no hard-coded colours.
- Text comes from translations; an icon-only control has an accessible name.

- `ui/`: token-styled shadcn `Button`, `Input`, `Label`, `Alert`, `Card`, `Skeleton`, `Select` (dropdown), `Switch`, `Checkbox` and `ToggleGroup` (pressable chips). Curated Lucide icons are exported by `ui/icons.tsx`.
- `brand/`: `HortaiLogo`, the five-mood owl companion `Hort`, and the decorative warm-paper landscape `WorldScene`. Hort references the canonical artwork in `public/brand/owl.svg`; `npm run brand:generate` exports matching icons and email assets. Interface colors come from semantic tokens; ambient motion respects calm mode and the OS preference. See [branding](../../docs/architecture/branding.md).
- `shared/`: `TextField` associates labels, hints and errors; `PasswordField` adds visibility and Caps Lock feedback; `FieldMessage` supplies consistent field feedback. `RouteErrorPanel` and `NotFoundPanel` provide translated recovery states.
- `shared/` also holds the single-card screen frame `HortPanel` (Hort on the edge, heading, content, footer), `SubmitButton`, and `FormAlert`; `brand/hort-mood.ts` (`hortMoodOf`) picks Hort's mood for a form.
- `shared/` also holds `SelectField` (a labelled shadcn `Select`; use it inside a `Controller`) and `ChoiceGroup` (a few big radio cards).
- `brand/character.tsx` (`Character`) draws a talking character (Max, Lili, Fina, ...) from a closed- and an open-mouth picture address; while `isSpeaking` the mouth alternates in an uneven rhythm (`src/hooks/use-lip-sync.ts`), stays open with reduced motion or calm mode, and a missing picture shows a paw. It knows nothing about the catalog: callers pass the addresses (the `tutors` module owns the catalog and the storage keys). `src/hooks/use-character-voice.ts` plays one stored audio file on request (play, stop, unavailable). Both are generic so every screen that shows a character reuses them.
- `src/hooks/`: `usePasswordField`, `useCountdown`, `useFocusOnMount` and `useBeforeUnloadGuard` (unsaved-work guard for editors) hold reusable browser interaction state.

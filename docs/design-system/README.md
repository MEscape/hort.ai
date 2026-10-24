# Hort.ai Design System v1

**Status:** working draft for the hackathon; ready for visual review, not yet user-tested.

This is the single reference for how child-facing Hort.ai screens should look and behave. We build on the existing design-token system rather than inventing a second theme. The goal is an original learning world that is as readable and reassuring as it is playful.

## See it

Run the existing Next.js project with `npm run dev` and open:

- `/en/design-system` — English component gallery
- `/de/design-system` — German component gallery

These routes are `noindex` and are not linked from the child's journey. They are **not authentication-protected**, so never put real child data, internal credentials, or unpublished assets in this gallery. The counting interaction uses local state only.

## Where the source of truth lives

| Concern                                               | Location                                                       |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| Colors, feedback states, fonts, radii, motion, themes | `src/app/globals.css`                                          |
| shadcn CLI configuration                              | `components.json`                                              |
| Reusable, generic UI primitives                       | `src/components/ui/`                                           |
| Shared composed patterns                              | `src/components/shared/`                                       |
| Visual examples (not production lesson components)    | `src/app/[locale]/(public)/design-system/`                     |
| Localized examples                                    | `src/i18n/messages/en.json` and `de.json` (`app.designSystem`) |
| Product design rationale                              | `docs/design-system/` and `docs/agents/designer-agent.md`      |

## Decisions made in v1

1. **Keep the existing identity.** Twilight indigo is the main action, Lagoon teal is reassuring, Glow gold highlights discovery, Bloom pink adds character. Fredoka and Nunito are already configured as local fonts.
2. **A single primary action per step.** `Button` variants are semantic, with touch-friendly sizes, focus visibility and a tactile press response.
3. **Never use danger for a wrong answer.** `FeedbackPanel` separates success, nudge and hint. System danger remains reserved for genuine system problems.
4. **Touchable, not drag-dependent.** The counting specimen uses click/tap/Enter/Space. The final lesson must offer equally accessible manipulation.
5. **Visuals teach.** Keep objects, instructions and feedback spatially related. Decorative effects must support understanding, not compete with it.
6. **One world across screens.** Child-facing cards and controls share typography, radii and depth. The three learning paths are layouts here; actual navigation remains for issue #12.

## How shadcn/ui fits

The repository already has `shadcn` as a development dependency and a `components.json`. The v1 Button and Card are **small app-owned shadcn-style primitives**, using the project's existing utilities and semantic Tailwind tokens. They do **not** claim to be generated verbatim by the current shadcn CLI.

When adding a more complex primitive such as Dialog, use the installed shadcn generator, review its dependencies and generated defaults, then adapt it to Hort.ai's tokens, typography, focus behavior and accessible interactions. Do not reimplement Dialog focus management for visual convenience, and do not replace these shared primitives ad hoc from individual screens.

## Implementation workflow

1. Review a real user flow and the visual references in [`ux-guidelines.md`](ux-guidelines.md).
2. Reuse an existing component; if it doesn't fit, improve the shared component or add a documented variant.
3. Keep static style values in the token system, not JSX inline styles or arbitrary color utilities.
4. Add English and German translations with matching keys. The currently configured default locale is English; the gallery supports both.
5. Test keyboard access, accessible names, dynamic feedback, focus, reduced motion and responsive widths.
6. Validate with `npm run check` before merging. Run a quick adult stand-in walkthrough during the hackathon, and schedule genuine child testing later.

## Intentionally not decided here

- Final mascot name, proportions, expressions, illustration asset pack or sound language. The gallery companion is an explicitly labeled **sketch**.
- The final lesson concept, Zod/AI scene contract or scoring logic (issues #5, #6, #13–#15).
- Production home and lesson navigation, authentication or persistence (issues #9, #12, #17).
- A separate token palette in addition to `globals.css`.

See [`foundations.md`](foundations.md), [`components.md`](components.md) and [`ux-guidelines.md`](ux-guidelines.md) for the design contract.

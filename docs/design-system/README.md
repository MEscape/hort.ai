# Hort.ai Design System v1

Hort.ai's child-facing UI uses the existing design tokens, fonts, and localized copy to make learning screens clear, playful, and reassuring. The gallery shows the real shared components alongside a local-only hint-card specimen (hints for a task the child brought, never a solution).

Start the app with `npm run dev` to open the pages:

| Page            | English                                                     | Deutsch                                                        |
| --------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| Overview        | [Overview](http://localhost:3000/en/design-system)          | [Übersicht](http://localhost:3000/de/design-system)            |
| Buttons         | [Buttons](http://localhost:3000/en/design-system/buttons)   | [Buttons](http://localhost:3000/de/design-system/buttons)      |
| Cards           | [Cards](http://localhost:3000/en/design-system/cards)       | [Karten](http://localhost:3000/de/design-system/cards)         |
| Feedback        | [Feedback](http://localhost:3000/en/design-system/feedback) | [Rückmeldung](http://localhost:3000/de/design-system/feedback) |
| Hint card       | [Hints](http://localhost:3000/en/design-system/lesson)      | [Hinweise](http://localhost:3000/de/design-system/lesson)      |

## Reusable components

- `Button`: [`src/components/ui/button.tsx`](../../src/components/ui/button.tsx)
- `Card`: [`src/components/ui/card.tsx`](../../src/components/ui/card.tsx)
- `FeedbackPanel`: [`src/components/shared/feedback-panel.tsx`](../../src/components/shared/feedback-panel.tsx)
- Tokens and fonts: [`src/app/globals.css`](../../src/app/globals.css)

## Adding a shadcn/ui component

Run `npx shadcn add <component>` using the repository's `components.json`. Review generated dependencies, then adapt defaults to Hort.ai tokens and the existing accessibility and localization rules. Extend the shared component and its gallery example; do not add a duplicate primitive.

# Reusable components v1

Use the component gallery for their live appearance. **Create a new visual variant in the shared primitive first** if multiple screens need a treatment; don't style one screen differently for the same action.

## `Button` (`src/components/ui/button.tsx`)

| `variant`   | Job                                                      |
| ----------- | -------------------------------------------------------- |
| `default`   | One main action: start, continue, confirm                |
| `accent`    | Offer an optional hint or highlight discovery, once      |
| `secondary` | Supportive actions, choosing another approach            |
| `outline`   | Back, undo, alternative actions                          |
| `ghost`     | Quiet secondary controls                                 |
| `link`      | An action inside running text                            |
| `danger`    | Destructive parent-area actions, never a child's mistake |

`size`: `sm` (40px), `default` (48px), `lg` (56px), `icon` (48px square) and `icon-sm` (40px square). This is the shadcn Button refitted to Hort.ai's tokens; `asChild` renders a locale-aware `Link` with the button look. The native `button` has no default `type`: set `type="button"` or `type="submit"` explicitly inside forms. Always provide an accessible label for icon-only instances. Disabled controls must have a meaningful explanation nearby; when possible, hide unavailable paths or mark them as forthcoming instead of trapping the child.

Example:

```tsx
<Button variant="accent" onClick={handleHint}>
  {t('hint')}
</Button>
```

The variant values are app-owned conventions, not a claim of a verbatim shadcn-generated API. Do not use `asChild` until a real composition primitive is added and reviewed.

## `Card` (`src/components/ui/card.tsx`)

`Card`, `CardHeader`, `CardContent` and `CardFooter` come from shadcn. The `tone` prop: `surface` (default), `sunken` and `highlight` are **visual containers**, not interactive elements. A navigation destination should use the project's locale-aware `Link`, with a visible focus treatment, rather than attaching an unannounced click handler to a `div`. Use cards to clarify a choice, not as generic decoration around every paragraph.

## `FeedbackPanel` (`src/components/shared/feedback-panel.tsx`)

`success`, `nudge` and `hint` communicate meaning through the border/background, a symbol, title and explanation. Keep titles action-oriented and age-appropriate. A wrong answer should lead to a clue or a chance to try again. Do not show system danger for a learning mistake, and do not award or deduct points, stars or XP.

For dynamically appearing feedback, the enclosing lesson flow must manage announcements and focus so screen-reader users know the next step. Do not assume that adding visual feedback alone announces it. The hint-card specimen announces each newly shown hint through a polite live region.

## Planned components — not implemented in v1

- **Dialog:** install a real accessible shadcn dialog primitive before designing celebrations or parent controls.
- **Activity selection and object movement:** build a typed learning-scene component only after the Zod contract and the first lesson goal are chosen.
- **Audio affordance:** define meaningful server-driven states before promoting it into a reusable widget. Hort.ai has no points, stars, XP or levels in the MVP.
- **Mascot reactions:** choose a consistent vector/illustration system and define emotional states before shipping final assets.

The v1 gallery's hint card is a **local-only presentation specimen**, not a learning module, backend API or AI output renderer. Hort.ai never sets its own exercises: the task shown is one a child brought from school, and the companion gives hints only, never the solution.

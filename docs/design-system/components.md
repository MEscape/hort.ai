# Reusable components v1

Use the component gallery for their live appearance. **Create a new visual variant in the shared primitive first** if multiple screens need a treatment; don't style one screen differently for the same action.

## `Button` (`src/components/ui/button.tsx`)

| `variant`   | Job                                           |
| ----------- | --------------------------------------------- |
| `primary`   | One main action: start, continue, confirm     |
| `secondary` | Supportive actions, choosing another approach |
| `accent`    | Offer an optional hint or highlight discovery |
| `outline`   | Back, undo, alternative actions               |
| `ghost`     | Quiet secondary controls                      |

`size`: `sm` (48px minimum), `default` (56px minimum), `lg` (64px minimum), and `icon` (56px square). Its native `button` defaults to `type="button"` and accepts `type="submit"` for forms. Always provide an accessible label for icon-only instances. Disabled controls must have a meaningful explanation nearby; when possible, hide unavailable paths or mark them as forthcoming instead of trapping the child.

Example:

```tsx
<Button variant="accent" onClick={handleHint}>
  {t('hint')}
</Button>
```

The variant values are app-owned conventions, not a claim of a verbatim shadcn-generated API. Do not use `asChild` until a real composition primitive is added and reviewed.

## `Card` (`src/components/ui/card.tsx`)

`surface` (default), `sunken` and `highlight` are **visual containers**, not interactive elements. A navigation destination should use the project's locale-aware `Link`, with a visible focus treatment, rather than attaching an unannounced click handler to a `div`. Use cards to clarify a choice, not as generic decoration around every paragraph.

## `FeedbackPanel` (`src/components/shared/feedback-panel.tsx`)

`success`, `nudge` and `hint` communicate meaning through the border/background, a symbol, title and explanation. Keep titles action-oriented and age-appropriate. A wrong answer should lead to a thinking prompt or a chance to try again, never the solution or a punishing message. Hort.ai has no XP or reward system; see the [product vision](../product/vision.md).

For dynamically appearing feedback, the enclosing lesson flow must manage announcements and focus so screen-reader users know the next step. Do not assume that adding visual feedback alone announces it. The counting specimen provides an `output` live region for count changes.

## Planned components — not implemented in v1

- **Dialog:** install a real accessible shadcn dialog primitive before designing celebrations or parent controls.
- **Task entry and hint controls:** compose the child's own task, teacher assignments and contextual help; do not create an exercise or lesson catalog.
- **Session status and audio affordance:** represent actual pending, saved, speaking and listening states. Learning evidence is not an XP counter or reward mechanic.
- **Companion reactions:** use the predefined Max, Lili and Fina companions. Appearance, personality and voice are maintained as fixed combinations; expressions must not imply automatic emotional inference, which is outside the MVP.

The v1 gallery's apple interaction is a **local-only presentation specimen**, not a learning module, backend API or AI output renderer. It uses click/tap and keyboard activation; no drag-only dependency. Its wording and local state are not templates for task generation, answer checking or real session persistence. The [concept overview](../product/flows.md) describes the intended product without prescribing those implementations.

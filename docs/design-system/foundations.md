# Foundations

All visual values come from the existing `src/app/globals.css`; this document explains **how to choose** between them. The gallery is the visual companion to this document.

## Semantic colors

| Role             | Token prefix                | Tailwind example                         | Use                                                  |
| ---------------- | --------------------------- | ---------------------------------------- | ---------------------------------------------------- |
| Primary action   | `--hortai-color-primary`    | `bg-primary text-primary-foreground`     | Main next step, navigation emphasis                  |
| Secondary action | `--hortai-color-secondary`  | `bg-secondary text-secondary-foreground` | Reassurance and supporting actions                   |
| Discovery        | `--hortai-color-accent`     | `bg-accent text-accent-foreground`       | Contextual hints and milestone moments               |
| Character accent | `--hortai-color-bloom`      | `bg-bloom text-bloom-foreground`         | Illustration and playful details, never error status |
| Page canvas      | `--hortai-color-background` | `bg-canvas`                              | Screen surroundings                                  |
| Cards            | `--hortai-color-surface`    | `bg-surface`                             | Reading surfaces and activity areas                  |
| Quiet surfaces   | `--hortai-color-sunken`     | `bg-sunken`                              | Secondary groupings                                  |
| Text             | `--hortai-color-text`       | `text-copy`                              | Main copy                                            |
| Supporting text  | `--hortai-color-text-muted` | `text-copy-muted`                        | Guidance and secondary labels                        |
| Focus            | `--hortai-color-focus`      | global `:focus-visible`                  | Clear keyboard location                              |

**Do not use the default Tailwind palette or raw hex values in components.** Tokenized text on solid fills uses each color's matching `*-foreground`; text on light surfaces uses `*-copy` roles.

### Child-facing feedback

- **success:** a completed learning action (`success`, `success-subtle`, `success-border`).
- **nudge:** a constructive second attempt; never danger, minus points or a red X.
- **hint:** optional scaffolding, not a forced disclosure of the answer.
- **danger/warning:** system or parent-facing problems, not correctness judgements.

Pair color with short text and a symbol. Never make meaning depend on hue alone.

## Typography

- **Fredoka** (`font-heading`): approachable headings, short card titles and primary actions.
- **Nunito** (`font-body`): readable instructions, feedback, supporting text and running copy.
- **Atkinson Hyperlegible:** existing `data-font="readable"` preference; do not remove it.
- **`text-lead`:** important instructions. Keep them short and use `measure` to limit reading width.
- **`text-display`:** a single major page headline, not every card.

Avoid all-caps paragraphs, narrow text columns of tiny text and decorative lettering in instructions. The intended audience includes children who cannot read quickly; a future audio affordance must repeat the same instruction.

## Shape and spacing

- `rounded-token-sm`: compact chips and small supporting shapes.
- `rounded-token`: tappable controls.
- `rounded-token-lg`: learning objects, feedback and content groupings.
- `rounded-token-xl`: feature panels and a learning stage.
- `shadow-soft`: resting surface; `shadow-lift`: subtle interactive elevation.

Default buttons have a **48 CSS-pixel height** (`h-12`), small buttons 40 (`h-10`, parent area and toolbars only) and large buttons 56 (`h-14`); child-facing main actions use `lg`. These are starting specifications, not substitutes for real tablet testing. Use space around adjacent targets as well.

## Layout and motion

The gallery explores a landscape stage around 16:10, with the task as the visual focus and the companion in a supporting position. This is a layout example, not a fixed product requirement. Real homework-help screens must support their content and the [product vision](../product/vision.md), growing naturally on narrow screens. Do not impose `overflow: hidden` on the whole app without checking zoom, text scaling and small-viewport clipping.

Existing `data-world` styles change backgrounds only, preserving consistent foreground contrast. Meaningful state changes may use brief pop/lift motion, but default animations must obey `prefers-reduced-motion` and `data-motion="calm"`. No continuous confetti, flashing feedback, or animation that delays the next action.

## Accessibility gate

Review each new component and screen for WCAG 2.2 AA requirements (including non-text contrast and visible focus), tap size, keyboard activation, readable zoom, and labels for icon-only controls. `globals.css` documents its color contrast assumptions; validate composed screens rather than assuming inherited contrast guarantees every layout.

---
name: ui-polish
description: Use when building or refining a HortAi screen with shadcn and Tailwind, or when a UI looks generic or unfinished. Refines within the existing design system for a clear, calm, child-friendly result; refinement, not redesign.
---

# UI Polish

A demo is judged in the first seconds of looking at it. Polish is the difference between "works" and "convincing", but in a hackathon it must stay **refinement within the existing design**, not a redesign.

## Ground rules

- **Use the system that exists.** Tokens, components and patterns from `src/components/README.md`, the design-system docs and `docs/rules/styling.md`. No new colors, fonts, spacing scales or one-off CSS when a token or component exists. New components go through `docs/conventions/adding-a-ui-component.md` (`npm run gen`).
- **Keep identity, copy and behavior.** Change how it looks and reads, not what it does or says, unless asked.
- **Know the audience.** Child screens: primary-school children, little reading, large touch targets, one clear next action, friendly and calm, no clutter, no pressure mechanics. Parent screens: trustworthy, scannable, efficient.

## Pass order

1. **Hierarchy:** one obvious primary action per screen; headings, body and secondary text clearly distinct.
2. **Spacing and alignment:** consistent spacing from the scale, aligned edges, enough whitespace; nothing cramped on mobile.
3. **Typography:** readable sizes (larger on child screens), short line length, no walls of text; German words wrap without breaking the layout.
4. **States:** designed loading, empty, error and success states; disabled states that are also semantically disabled.
5. **Feedback and motion:** immediate response to taps and clicks; subtle transitions only, respect `prefers-reduced-motion`.
6. **Accessibility:** contrast, focus rings, labels, roles; `docs/rules/accessibility.md`.
7. **Consistency:** same pattern for the same thing across screens.

Avoid the generic AI look: purple-blue gradients, gradient text, glassmorphism everywhere, decorative emoji, side-stripe cards, everything centered. Prefer one strong, calm visual idea applied consistently.

## Verify

Look at the rendered result on desktop and mobile, in DE and EN, before and after (screenshots). Fix everything you see in one batch, check once more, then stop; open-ended polishing burns time. For a formal review run `docs/agents/designer-agent.md`. Behavior changes still need tests (`test-driven-development`).

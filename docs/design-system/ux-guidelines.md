# Hort.ai interaction principles

## Reference products — study the reason, not the pixels

- **[Khan Academy Kids](https://learn.khanacademy.org/khan-academy-kids/):** learn from character-guided onboarding, clear activity affordances, and playful educational interaction. Their target ages overlap with, but are not identical to, Hort.ai's 5–10 range. **Do not** reproduce proprietary artwork, mascots, screens, or copy.
- **[Samio Learning](https://samiolearning.com/):** study visually structured exercises, contextual support and progress clarity. Adapt the principles, not their UI layout or graphical assets.
- **Hort.ai's own designer review:** `docs/agents/designer-agent.md` is the main internal experience brief. Individual patterns should be supported by a child-facing learning goal rather than added for novelty.

## Apply practical UI/UX principles

| Principle                     | Concrete implementation decision                                          | How to review                                                    |
| ----------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Fitts's law                   | Large, separated objects and buttons within reach of the task             | Try on a tablet with one hand; check accidental neighboring taps |
| Hick's law / cognitive load   | One primary decision at a time; three obvious entry paths only on the hub | Ask a first-time tester what they should do next                 |
| Jakob's law / consistency     | Familiar home, back, help and repeat-audio controls in stable positions   | Compare the same control across hub, lesson and feedback         |
| Gestalt proximity             | Keep counts, hints and next actions near the object they describe         | Cover the text: can users tell what belongs together?            |
| Visibility of system status   | Show selection, completion and pending state immediately                  | Tap, wait, reload; observe whether state remains understandable  |
| Error prevention and recovery | Undo or try again without punishing mistakes                              | Deliberately choose a wrong answer and verify a safe return path |

## Child-centred checks for every screen

1. A child can name the main activity after a quick look, without a developer explaining it.
2. The instruction is brief, positive and can eventually be repeated by audio.
3. Objects look interactive when they are; artwork does not masquerade as an inert button.
4. Each meaningful action yields visible and accessible feedback.
5. A wrong answer invites reasoning and another attempt, never a red failure state.
6. The interaction works with touch and keyboard. Dragging always has a non-drag alternative.
7. No countdowns, streak-loss threats, leaderboards or guilt-inducing return pressure.
8. Motion is purposeful, brief, interruptible, and optional for reduced-motion users.
9. Reading size, focus, contrast, zoom and target spacing survive the supported tablet viewport.
10. An age 5 beginner and an age 10 learner may need different reading density; do not assume one exact pace fits all.

## MVP review routine

Show someone the first flow without giving instructions: open the hub, choose a path, understand the visual lesson, try a wrong answer, recover, receive encouragement, and continue. Record confusing elements and fix the most obstructive failure. During a hackathon an adult stand-in is useful for early feedback, but it does not replace testing with actual children in a safe, consent-appropriate setting.

Hort.ai should feel **like an illustrated learning workshop, not a chatbot with colorful cards**. Borrow the reason a pattern works, then express it in Hort.ai's established palette and interaction language.

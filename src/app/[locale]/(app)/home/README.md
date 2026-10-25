# Child home

`/de/home` and `/en/home`. What a child in grades 1 to 4 sees first: the companion with its daily feeding (unchanged), a slim status strip, and four big cards. No navigation bar; everything is reached through the cards.

## What is real and what is not yet

| Part                                  | Source today                                                                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Name, companion, voice, limit, window | The child profile (`requireOnboarded`).                                                                                                   |
| Companion mood, feeding               | `loadProgressDto`, `CompanionCard` (the feeding game is untouched).                                                                       |
| Screen-time state                     | `computeScreenTime` (learner domain) on the **server's** clock; the browser keeps it current from the server time, not the device's.      |
| Learning time used today              | **Not measured.** With a daily limit the strip says "time is not shown yet", never "unlimited". Pass `usedMinutes` once something counts. |
| Running session, unfinished task      | **No backend yet** (#17 sessions, #12 session start). `session` and `unfinished` are `null`; the continue card and session chip hide.     |
| Teacher assignments                   | **No child-facing list yet** (#33). `teacherNewCount` is `null`: the card says "not here yet".                                            |
| World preview                         | Islands from the world module. Nothing records discoveries yet, so only the starting island is clear and the rest lie in fog.             |
| Photo task                            | Out of the MVP scope in `docs/product/vision.md` and no upload backend: the camera button only has the companion say so.                  |
| "Type or say it"                      | Links to the existing task entry at `/start`.                                                                                             |

Enforcement of a closed day (limit reached, outside the allowed hours) must be done by the use cases that start a task; this screen only reflects it. `computeScreenTime` is the one function both should call.

## The guide

`src/hooks/use-guide.ts` (reducer in `guide-reducer.ts`) is the reusable controller: `pointAt(target, line, { dwellMs, moves })` and `stop()`. `use-home-guide.ts` measures the page (`measure-guide.ts`, `place-guide.ts`) and turns a tap into a place to stand and one fixed line (`app.home.guide.*`). A new tap replaces the line; no queue. In calm mode (`data-motion="calm"`, `prefers-reduced-motion`) the companion never moves: the bubble stands next to the card and the card gets a ring.

**One greeting.** The page shows no greeting text of its own (the `h1` is for screen readers). On arrival the companion says one short, name-less line (`hello`, or `welcomeBack` pointing at a waiting task), not again for ten minutes. The stage's line takes the place of the level meter, which fades while it is said, so nothing is covered.

**Voice.** Every line is text first. When the parent's voice control is on and the page is German, the same words are also spoken in the companion's own voice through the voice module (`UI_LINES`, `useSpokenLine`); otherwise they stay text. The page never sends words to the provider, only the name of a fixed line. A child's name never leaves the page.

**Loading.** `home-loading.tsx` draws the same frame, grid and card shapes as the page (`home-layout.ts` is shared), so nothing jumps when it arrives.

`CLOSED_KEEPS_COMPANION_AND_WORLD` in `_components/screen-time-view.ts` is the one flag for whether a closed day still allows feeding and the world.

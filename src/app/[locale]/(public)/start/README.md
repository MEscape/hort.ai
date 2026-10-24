# Homework start screen

Preview: `/de/start` and `/en/start`. The existing design-system gallery is independent of this route.

The three choices open local task entry, an unavailable teacher-assignment state, or an unavailable continuation state. Task text has a 1,000-character limit, whitespace validation and a clear action. It stays in React memory while moving between these views; leaving or reloading the route clears it. Nothing is submitted, saved, logged or sent to an AI.

## Backend handoff (issue #12)

Replace the local unavailable notice in `_components/task-entry.tsx` with a Server Action calling the authenticated session-creation use case once its contract exists. Validate ownership and task input on the server; show only a validated thinking prompt that passes the solution-leak guard. Load real teacher assignments (#33) and unfinished sessions (#17) through their public module interfaces. Obtain the greeting name from the approved child-profile interface when available.

The provisional, original SVG artwork lives in `_components/start-illustration.tsx`. Shared Button, Card and FeedbackPanel implementations and tokens are reused without changes.

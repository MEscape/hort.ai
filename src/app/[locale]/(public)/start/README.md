# Homework start screen

Preview: `/de/start` and `/en/start`.

The three choices open local task entry, the teacher assignments of a child class, or an unavailable continuation state. School tasks load only with `?child=<childProfileId>` in the signed-in parent session (see `src/modules/assignments/README.md`); otherwise they show the unavailable state. Task text has a 1,000-character limit, whitespace validation and a clear action. It stays in React memory while moving between these views; leaving or reloading the route clears it. Nothing is submitted, saved, logged or sent to an AI.

## Backend handoff (issue #12)

Replace the local unavailable notice in `_components/task-entry.tsx` with a Server Action calling the authenticated session-creation use case once its contract exists. Validate ownership and task input on the server; show only a validated thinking prompt that passes the solution-leak guard. Load unfinished sessions (#17) through their public module interface; teacher assignments (#33) are already loaded through `assignmentsQueries.listChildAssignments`. Obtain the greeting name from the approved child-profile interface when available.

The original task, backpack and book SVGs live in `_components/start-illustration.tsx`. The header and companion use the official `HortaiLogo` and `Hort` components. Shared Button, compound Card, Label, Alert and current brown/cream/amber tokens are reused without changes.

The controlled task input remains ready for future transcript insertion through its existing `onDraftChange` callback. No microphone controls or voice APIs are wired here (#34).

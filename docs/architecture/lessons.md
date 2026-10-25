# Canvas-first lessons

The `lesson` module (`src/modules/lesson`, page `/learn`, reached from the first card on Home) explains through a scene the child acts on, not through chat. This is the vertical slice of R-004/R-021 from the team's requirements draft: comparing fractions on bridges over a river, grades 3 and 4, German and English.

## The contract

A lesson step (`domain/models/lesson-step.ts`, `LESSON_SCHEMA_VERSION = 1`) is:

- **scene**: a discriminated union on `template` (`compare-bridges`, `build-bridge`), each with its own bounded parameters (`FRACTION_LIMITS`: 2 to 8 planks). `isValidScene` is the one gate for authored and, later, generated scenes.
- **narration**: one short spoken-style sentence, as a message key. The same key can be drawn as a caption, read by voice or shown as side text (R-016, R-017).
- **feedback**: per outcome (`correct`, `notYet`, plus `hint` from the second miss), each a message key, a `SceneReaction` (`celebrate`, `wobble`, `line-up`, `count-planks`) and a `MascotState` (`idle`, `curious`, `thinking`, `cheer`, `oops`). Closed vocabularies only, never free-form animation.

The child answers with a structured scene event (`SceneAnswer`: `choose` top/bottom/same, or `fill` with a plank count), or writes in the side panel (`{ kind: 'text' }`). Typed text first passes the guidance module's #90 distress check (a hit returns `lesson.child_distress` and the trusted-adult notice, nothing else happens), then `readTextAnswer` reads it into a scene event by fixed German and English word lists. Exactly one meaning or nothing: "oben", "die untere", "3 von 4" are read; "oben oder unten" or "nicht oben" are `unclear`, asked again and not counted. No model reads the child's text. The Server Action validates it with a strict Zod union and the backend judges it in `evaluateAnswer` from the scene's own numbers. No answer key is stored or sent; feedback reaches the client only as the answer to an answer (`CheckSceneAnswer`). A miss never costs anything.

## The Stage

`Stage` (`src/components/shared/stage.tsx`, shared so homework help can use it too) is the one shell: the world's sky (`data-world="lagoon"`), step dots for orientation (no timer, no score), the scene, the companion with the single sentence, and a reward layer. Templates draw inside it and use only tokens (`island-*` colours, the shared keyframes), so a lesson looks like the island world. Every scene works by touch and keyboard (each bridge is a button, each plank a toggle), keeps its meaning with motion off (the hint is a static line, the names appear as numbers), and needs no reading beyond one sentence.

## Fallback

The authored lesson in `domain/lessons/` is complete on its own. When a model personalises steps later (wording, theme, numbers within the template's limits), it proposes a step; `isValidScene`, the safety checks and the solution-leak guard decide; anything invalid, unsafe or late falls back to the authored step, marked as authored and never presented as live AI (R-009). The client draws only templates it knows; a render failure lands in the route's error boundary.

## Not yet

- **Persistence and XP** (R-007/R-008): `CheckSceneAnswer` is a query and stores nothing; a reload starts the lesson again. Next: a lesson-progress repository and an idempotent XP grant through the progression module.
- **Voice**: narration is a caption only; speaking it needs catalog phrases or speech tickets in the voice module. The side panel ("Schreiben") is closed by default and opened by the child; once voice input exists it opens by itself when the microphone is unavailable.
- **AI personalisation**: no model call yet; see Fallback.
- **Homework help on the Stage**: `/start` and `/help` still use their own layout.
- **Permission**: lessons reuse `hint.request`; a `lesson.*` permission belongs in the auth role table when roles differ.

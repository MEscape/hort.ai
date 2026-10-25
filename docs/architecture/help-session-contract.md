# Help session contract for the learner UI

The typed contract between the child's help screen and the backend: start or resume a help session, ask for a hint, check the child's own answer, reply to the comprehension question. Status: **version 1, agreed on 2026-10-25; all five actions shipped** (PR #91 for hints and answers, the session actions on top of #93) with the threads building the hint ladder and actions (#30) and the help sessions (#17, #78), so the UI (#12) can be built against fakes while the backend lands. Where an endpoint PR ships a different shape, the shipped code wins and this document is updated to it. Screens and order: [`learner-ui-plan.md`](../product/learner-ui-plan.md).

Owning rules: [`api.md`](../rules/api.md), [`validation.md`](../rules/validation.md), [`errors.md`](../rules/errors.md), [`security.md`](../rules/security.md). Builds on the [AI output contract](ai-output-contract.md) (#6) and the guidance module's views (`src/modules/guidance/application/contracts/`).

## Ground rules

- **Never the solution.** No response type has a field for the expected answer, a solution key or a worked solution of the child's task. Every text is either AI text that passed the output contract, the solution-leak guard (#31) and the safety checks (#11), or a fallback whose wording lives in the i18n catalog.
- **The backend decides.** The hint level, the result of an answer check and "understood" come from the backend. The client never sends a level, a result, a solution or a status.
- **An AI failure is not an error.** A timeout, an invalid or an unsafe AI answer still returns `ok: true` with a predefined text (`kind: 'fallback'` or `'predefined'`). Errors are reserved for the request itself (sign-in, input, ownership, budget, infrastructure).
- **Server Actions, not Route Handlers.** The help screen is part of this app, so each operation is a Server Action in the guidance module's `presentation/actions/` that returns `ActionResult<T>` (`@lib/result`). Route Handlers are only for real HTTP consumers ([`api.md`](../rules/api.md)); Alexa keeps its own route.
- **Identity from the server.** The parent's session decides who asks; `childProfileId` is checked to be the parent's own child. Another parent's child answers exactly like an unknown one.
- **Safe to retry.** A hint request and an answer check carry a client-generated `requestId` (letters, digits, `-` and `_`, up to 128 characters; a UUID fits). A retried hint request with the same `requestId` returns the hint already given, without a new AI call. Starting a session and replying to the comprehension question need no `requestId`: a child has at most one active session, starting again with the same task returns it, and a question is answered once, so a repeat returns the stored state.

## Operations

| Action                     | Input                                                                              | Success data             | Provides          |
| -------------------------- | ---------------------------------------------------------------------------------- | ------------------------ | ----------------- |
| `startHelpSessionAction`   | `{ childProfileId, task, subject }` or `{ childProfileId, assignmentId, subject }` | `StartHelpSessionDto`    | #17, #33          |
| `getOpenHelpSessionAction` | `{ childProfileId }`                                                               | `HelpSessionDto \| null` | #17               |
| `requestHintAction`        | `{ requestId, childProfileId, sessionId }`                                         | `HintDto`                | #30 (on #10, #31) |
| `checkAnswerAction`        | `{ requestId, childProfileId, sessionId, answer }`                                 | `AnswerFeedbackDto`      | #14 (PR #81), #30 |
| `replyComprehensionAction` | `{ childProfileId, sessionId, reply }`                                             | `ComprehensionReplyDto`  | #78               |

The task text and the subject are sent once, when the session starts. Starting with a different task while a session is active ends the old one and starts a new one. A teacher assignment can be the source (`assignmentId`, #33): the backend checks that the child's current class has it, takes the task text from the assignment (a sent `task` is ignored) and answers another class's assignment with `guidance.assignment_not_found`. The solution key stays on the server and is read for each hint and answer check. Hint and answer calls name the session, and the backend reads the task, subject and ladder position from it.

All five live in `src/modules/guidance/presentation/actions/`, with their schemas in `presentation/schemas/guidance-schema.ts` and the DTOs in `presentation/dto/guidance-dto.ts`. Starting spends the child's `guidance.session-start` budget (30 in 10 minutes), because every new task stores a session; reading the open session and replying spend none (a read, and a reply that follows only a checked answer, which spent the check budget).

## Input schemas (presentation boundary)

Zod schemas next to each action, per [`validation.md`](../rules/validation.md). The backend re-checks every text as child input (`parseChildTaskText`: trimmed, 1 to 1000 code points, no control or invisible characters); the schemas only reject the wrong shape early.

As shipped, ids and the request id are bounded strings (1 to 128 characters) and the subject a short string; their exact shape (and `HINT_SUBJECTS`) is checked by the domain, which answers with the same field codes. Child texts are bounded at 2000 code units (the domain counts 1000 code points). In outline:

```ts
import { z } from 'zod';

const id = z.string().min(1).max(128); // the domain checks the exact shape
const requestId = id;
const childText = z.string().max(2000); // emptiness and characters are checked by the use case

export const startHelpSessionSchema = z.object({
  childProfileId: id,
  task: childText.optional(), // required unless assignmentId is given; the use case checks it
  assignmentId: id.optional(), // a teacher's assignment of the child's class (#33)
  subject: z.string().max(32), // the use case checks it against HINT_SUBJECTS
});

export const getOpenHelpSessionSchema = z.object({ childProfileId: id });

export const requestHintSchema = z.object({
  requestId,
  childProfileId: id,
  sessionId: id,
});

export const checkAnswerSchema = requestHintSchema.extend({
  answer: childText,
});

export const replyComprehensionSchema = z.object({
  childProfileId: id,
  sessionId: id,
  reply: childText,
});
```

Unknown keys are stripped by Zod's default; a `level`, `result` or `solution` sent by a client has no effect.

## Response types

```ts
/** The ladder from `domain/models/hint-level.ts`, lowest help first. No rung reveals the solution. */
type HintLevel =
  | 'understand_task'
  | 'activate_prior_knowledge'
  | 'next_step'
  | 'similar_example';

/** Why a predefined text was used instead of the AI's (`HintFallbackReason`). For logs and tests, not shown to the child. */
type FallbackReason =
  'timeout' | 'provider_unavailable' | 'invalid_output' | 'unsafe_output';

/** `HintOutcome` of the guidance module: validated AI text, or the predefined prompt of the level. */
type HintText =
  | { kind: 'generated'; level: HintLevel; text: string }
  | { kind: 'fallback'; level: HintLevel; reason: FallbackReason };

/** `FeedbackText` of #14 (PR #81). A predefined text has no text; the UI maps `feedback` to the catalog. */
type FeedbackText =
  | { kind: 'generated'; text: string }
  | {
      kind: 'predefined';
      feedback: 'answer_assessment' | 'praise' | 'comprehension_question';
      reason: FallbackReason | null; // null: the solution key decided, no AI text was asked for
    };

interface HintDto {
  sessionId: string;
  hint: HintText;
  /** 1 to 4, the rung the backend chose. For the "small steps" indicator, never shown as a score. */
  step: 1 | 2 | 3 | 4;
  /** True on `similar_example`. Asking again gives another similar example, never more help than that. */
  isTopStep: boolean;
}

/** `AnswerFeedback` of #14 (PR #81), plus the session it belongs to. */
type AnswerFeedbackDto = { sessionId: string } & (
  | {
      result: 'correct';
      assessedBy: 'solution_key' | 'ai';
      next: 'comprehension_question';
      praise: FeedbackText;
      question: FeedbackText;
    }
  | {
      /** null: no solution key and the AI's assessment failed or was rejected ("not assessable"). */
      result: 'partly_correct' | 'not_yet' | null;
      assessedBy: 'solution_key' | 'ai' | null;
      next: 'hint_ladder';
      message: FeedbackText;
    }
);

interface ComprehensionReplyDto {
  sessionId: string;
  /** Decided by `isTaskUnderstood`: a stored `correct` result and a stored reply. A `status` sent by the client is dropped. */
  status: 'working' | 'understood';
}

interface StartHelpSessionDto {
  /** `continued` when the same task (after normalization) and subject was already open. */
  outcome: 'started' | 'continued';
  session: HelpSessionDto;
}

type HelpSessionStatus =
  'working' | 'awaiting_comprehension_reply' | 'understood';

interface HelpSessionDto {
  sessionId: string;
  /** The teacher's assignment the session is on (#33); null for the child's own task. */
  assignmentId: string | null;
  /** The child's own text, or the teacher's assignment text. Never the solution key. */
  task: string;
  subject: 'math' | 'german' | 'general_studies' | 'english';
  status: HelpSessionStatus;
  /** The rung the session is on, null before the first hint. */
  hintLevel: HintLevel | null;
  /** Hints given so far, oldest first, as stored; lets "Continue" show where the child was. */
  hints: readonly HintText[];
  /** Answer checks so far, oldest first, so the screen can resume after a check. No answer text, no solution. */
  answerChecks: readonly {
    result: 'correct' | 'partly_correct' | 'not_yet' | null;
    assessedBy: 'solution_key' | 'ai' | null;
    hintLevel: HintLevel | null; // the rung the session was on at the time
  }[];
  /** The open comprehension question while `status` is `awaiting_comprehension_reply`, else null. */
  openQuestion: FeedbackText | null;
  /** ISO instant of the last step, for "Continue". */
  updatedAt: string;
  /**
   * How the session opens (#92, additive). `clarify`: one fixed clarifying question, the child's reply
   * goes to the task once more. `redirect`: small talk or a curiosity question, a fixed friendly text
   * and no hint. `null`: help as usual. The text is always a catalog text, never AI text.
   */
  opening:
    | { kind: 'clarify' }
    | { kind: 'redirect'; intent: 'small_talk' | 'curiosity' }
    | null;
}
```

The UI never stores session state as the truth: after a reload it calls `getOpenHelpSessionAction` and renders what comes back.

## Errors

`ActionResult` failures carry a stable `code`, optional `fieldErrors` and, for a refused budget, `retryAfterSeconds`. The UI maps codes to friendly, never punishing text; it never shows `message`.

| Code                                    | When                                                                                                                                              | UI state                                                                                                                                                                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.unauthenticated`                  | no signed-in parent                                                                                                                               | back to sign-in, keep the typed text locally                                                                                                                                                                                                                          |
| `auth.permission_denied`                | the actor may not ask for help (`hint.request`)                                                                                                   | parent gate message                                                                                                                                                                                                                                                   |
| `learner.not_found`                     | unknown child, or not the parent's own                                                                                                            | "We could not find this profile" and back to start                                                                                                                                                                                                                    |
| `guidance.validation_failed`            | `fieldErrors`: `guidance.validation.child_profile_id_invalid`, `guidance.validation.subject_invalid`, `guidance.validation.assignment_id_invalid` | treat as a bug: generic retry, focus the subject choice for `subject_invalid`                                                                                                                                                                                         |
| `guidance.child_input_invalid`          | `fieldErrors` under `task`, `answer` or `reply`: `guidance.child_input.empty`, `.too_long`, `.contains_control_character`                         | gentle prompt on that field ("Write your task here", "That is a lot of text, can you shorten it?"), input kept                                                                                                                                                        |
| `guidance.rate_limited`                 | the child's budget is used (20 hints, 10 checks or 30 starts in 10 minutes)                                                                       | calm pause line from the companion; re-enable after `retryAfterSeconds`, no visible countdown                                                                                                                                                                         |
| `guidance.rate_limiter_failed`          | the budget could not be checked                                                                                                                   | "Hort needs a moment", retry button                                                                                                                                                                                                                                   |
| `guidance.session_not_found`            | unknown, ended or another child's session                                                                                                         | reload the open session; if none, back to start                                                                                                                                                                                                                       |
| `guidance.assignment_not_found`         | the assignment is not (or no longer) one of the child's class: another class's, deleted, or the child left the class                              | "This school task is not available any more", back to the task list                                                                                                                                                                                                   |
| `guidance.session_store_failed`         | the session could not be read or written                                                                                                          | "Hort needs a moment", retry button, input kept                                                                                                                                                                                                                       |
| `guidance.no_open_question`             | a reply, but no comprehension question waits for one (already answered, or none asked)                                                            | reload the open session and show what it says                                                                                                                                                                                                                         |
| `guidance.child_safety.distress_signal` | the task, answer or reply clearly signals distress (#90); `fieldErrors` under that field carry the same code                                      | no hint, no retry prompt: the companion's help text `guidance.distress.*` (thanks, brave, trusted adult, Nummer gegen Kummer 116 111 with hours, 110/112); `isChildDistressCode(code)` switches to it, `messageKeyForCode` gives the one-paragraph `distress.summary` |
| any other                               | infrastructure failure                                                                                                                            | "Something went wrong, let's try again", input kept                                                                                                                                                                                                                   |

The session codes come with #30 and #17; an ended session is deliberately not a code of its own. A wrong answer is never an error: it is `ok: true` with `result: 'not_yet'`.

### A child in distress (#90)

Every child text (task at start, answer, comprehension reply) first passes `detectDistressSignal` (`guidance/domain/child-safety/`), a short deterministic catalog of first-person phrases in German and English (thoughts of dying or self-harm, violence or abuse against the child, acute danger). It runs right after the input is parsed: before the budget, the session store, the topic or safety classifier and any AI call. A hint request carries no new text; its task passed the check at start.

- On a match the action fails with `guidance.child_safety.distress_signal` and nothing else happens: no hint, no assessment, no stored step.
- The log gets one anonymous `guidance.child_safety.distress_signal` audit event (`warn`) with only the category (`self_harm`, `violence_or_abuse`, `acute_danger`) and the field; no tenant, actor, child or session id, never the text.
- Nobody is notified automatically, not the parent either: the parent may be part of the problem, and an alarm the child did not choose can harm them. The text points the child to a trusted adult and the Nummer gegen Kummer (116 111, free, anonymous, Monday to Saturday 2 pm to 8 pm according to nummergegenkummer.de, checked 2026-10-25), and to 110/112 in acute danger.
- Only strong signals match. Story text in the third person ("Die Katze ist tot", "Tom schlägt den Ball"), worries about school ("Angst vor der Mathearbeit") and hyperbole ("Mathe bringt mich um") do not. A distress phrase quoted inside a task does match; that false positive costs one calm help text and is accepted.

## Fallback states

| Situation                                       | What the backend returns                                                                                              | What the child sees                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| AI off, timed out or unavailable                | `HintText` `kind: 'fallback'` with the level                                                                          | the predefined prompt of that level, i18n key `guidance.hint.fallback.<level>` |
| AI hint broke the output contract or was unsafe | `kind: 'fallback'`, reason `invalid_output` / `unsafe_output`                                                         | same; the child cannot tell the difference                                     |
| AI hint leaked the solution (#31)               | `kind: 'fallback'`, the reason #31 maps the rejection to (code `guidance.ai_output.solution_leaked` stays in the log) | same                                                                           |
| Answer not assessable                           | `result: null`, `next: 'hint_ladder'`, predefined message                                                             | an encouraging line and the hint button                                        |
| Praise or question rejected                     | `kind: 'predefined'` for that text                                                                                    | the predefined praise or question                                              |

Fallback wording lives in the guidance module's i18n catalog, keyed by level or feedback kind, in German and English, and is owned by the backend team (hint wording: Zisch).

## Open points

- The `opening` field (#92) is returned by the start and "Continue": the decision comes from [`topic-classification.md`](topic-classification.md), the UI maps `kind` and `intent` to `guidance.opening.clarify` or `guidance.opening.redirect.<intent>`, and the child's reply to a clarifying question goes in through the start action again, as the task with the explanation added.

- Whether starting a session also returns the first thinking prompt, or the UI asks for the first rung (`understand_task`) right after start. This document assumes the latter, so the start stays cheap and the ladder has one entry point (#30 decides).
- The reply action does not grant any progression. Whether a finished task earns anything is open: the product direction drops XP and streaks unless re-confirmed, and only the small progression the [vision](../product/vision.md) allows may follow, granted by the backend, never by the UI.

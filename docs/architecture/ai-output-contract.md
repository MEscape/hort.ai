# AI output contract

Everything the AI may return to Hort.ai, and how the backend decides whether to use it. AI output is untrusted until it passes this contract (#6). Owning rules: [`validation.md`](../rules/validation.md) and [`security.md`](../rules/security.md). Code: `src/modules/guidance/domain/ai-output/`, codes in `src/modules/guidance/domain/errors/ai-output-errors.ts`, tests in `__tests__/src/modules/guidance/domain/`.

Hort.ai is a homework companion. It has no exercises of its own and never solves the child's task. The AI only words thinking prompts, graduated hints, praise, comprehension questions and assessments of the child's own answer. The backend decides everything else, including which kind of output it wants and at which hint level.

## Where it runs

```text
provider adapter (infrastructure, #10)
  └─ JSON.parse of the model response
      └─ validateAiOutput(raw, { kind, hintLevel })   ← this contract (domain)
          └─ solution-leak guard (#31)                ← needs the task and its solution
              └─ safety checks on the text (#11)
                  └─ safety classifier, when configured (Jev)
                  └─ shown to the child
```

The prompt that asks for the output is built by `buildHintPrompt` (`domain/prompt/hint-prompt.ts`): fixed instructions that never contain the child's text, and the task and competencies as a separate JSON data block. The child's task enters only as a `ChildTaskText` (`domain/models/child-task-text.ts`: trimmed, at most 1000 characters, no control or invisible characters). The safety checks on the text are `checkChildSafeText` (`domain/child-safety/check-child-safe-text.ts`): no requests for personal data, no secrecy, no inappropriate words. `HintOrchestrator` runs the whole chain and logs every fallback as `guidance.hint_fallback_used` with level, reason and codes. `RequestHint` grounds each request in the curriculum of the child's own federal state and grade (from the profile, never the request) through the curriculum module's `findRelevantCompetencies` (#28); when retrieval fails, the hint goes ahead without competencies and `guidance.grounding_unavailable` is logged. Feedback on the child's own answer (#14) goes through `AnswerCoach` (`application/services/answer-coach.ts`): with a teacher's solution key the result is decided by `checkAgainstSolutionKey` (`domain/answer-check/`), never by the AI, and the key is never sent to it; without a key the AI's `answer_assessment` is validated like any output. Praise and the comprehension question are validated too, and `checkChildSafeText` also rejects punishing wording. Every rejected answer falls back to the predefined text of its kind and is logged as `guidance.feedback_fallback_used`.

The hint ladder (#30) decides each hint's level in the backend: `nextHintLevel` (`domain/hint-ladder/next-hint-level.ts`) climbs one rung above the highest hint already given in the session, starting at `understand_task` (or at `activate_prior_knowledge` once an answer was partly correct), and stays on `similar_example` at the top, because no rung reveals the solution. The session state comes through the `HintSessionStore` port (`domain/ports/hint-session-store.port.ts`): only an active session of exactly this tenant, parent and child is found; the task and its subject come from the stored session, never from the client. `RequestHint` (`application/commands/request-hint.ts`) takes `{ childProfileId, sessionId, requestId }`; a retried request with the same `requestId` returns the hint it already got without a new AI call, and every new hint (generated text, or the fallback level and reason) is recorded for the session. If recording fails, the child still gets the hint and `guidance.step_not_recorded` is logged.

`CheckAnswer` (`application/commands/check-answer.ts`) is the use case over `AnswerCoach`. It follows `RequestHint` step by step and shares its steps through `application/services/session-step.ts`: the `hint.request` permission (same parent, same child, same kind of AI cost, so no permission of its own), the input checks (the answer is a `ChildTaskText` like the task, with field errors under `answer`), the child's ownership, the child's own `guidance.answer-check` budget (smaller than the hint budget, since one check costs up to three AI calls; it denies when the limiter store is down), the stored session (its task, and its current rung, which the feedback is worded at), and the same curriculum grounding and fallback. It passes no solution key yet (#33), records the check for the session (#78: result, who assessed it, and the validated texts the child saw) and logs one `guidance.answer_checked` event with ids, level, result and `assessedBy` only, never the task or the answer. Until the help-session repository lands (#17), composition wires a store that finds no session.

Both are reached from the child's screen through the Server Actions `requestHintAction` and `checkAnswerAction` (`presentation/actions/`), not Route Handlers: their only consumer is our own UI (docs/rules/nextjs.md). The schemas drop every key the session decides (level, task, subject). A fallback hint carries no text; the UI shows `guidance.hint.fallback.<level>` from the module's catalog, and the predefined feedback texts live under `guidance.feedback.fallback`.

On any rejection the caller discards the output, logs the rejection code (never the text or the child's input), and uses a predefined fallback for the requested kind and hint level (#10).

## Provider: Gemini API (#10)

The adapter is `GeminiProvider` (`infrastructure/gemini/`): Gemini 3.8 Flash (`gemini-3.8-flash`) through `generateContent` on the Gemini API, plain `fetch`, no SDK. The fixed instructions go in as the system instruction, the JSON data block as the only user message, with JSON output and every safety category at `BLOCK_LOW_AND_ABOVE`. The key travels in the `x-goog-api-key` header, never in the URL. A missed deadline is `timeout`, everything else `unavailable` with the HTTP status or the error name at most, never the key or the child's text.

**For the hackathon demo only.** The Gemini API terms exclude services likely to be used by people under 18 (and so do Google Cloud's terms for Vertex AI), and on the free tier Google uses prompts and answers to improve its products. The provider must be re-assessed before any test with children; the port keeps it replaceable.

Without `GEMINI_API_KEY` the AI is off and every hint is the predefined prompt of its level. Configuration (`src/lib/config/ai-env-schema.ts`, `.env.example` section 8): `GEMINI_API_KEY` (from Google AI Studio, server-only secret), `GEMINI_API_URL`, `GEMINI_MODEL_ID`, `GEMINI_TIMEOUT_MS` (default 8000). Tests use fakes only; no test reaches Google.

### Second safety check: Jev

With `TYPESAFE_API_KEY` set, every text that passed the word lists is also rated by TypeSafe's Jev decision model (`infrastructure/typesafe/jev-safety-classifier.ts`, `SafetyClassifier` port). One `POST /v1/systemone` asks one yes/no question per child-safety rule (personal data, secrecy, inappropriate content, discouraging), with the AI text as the state only; Jev answers with probabilities, never text. `flaggedBySafetyScores` (domain) flags a rule at 0.5 or above, and any score that is not a probability; a rule Jev did not answer counts as flagged. A flagged text falls back with reason `unsafe_output` and the rule's code. If Jev cannot answer in `TYPESAFE_TIMEOUT_MS` (default 3000), the text is not shown either (`guidance.child_safety.classifier_unavailable`): the predefined prompt is always safe. The questions are in English, Jev's strongest language; German texts are handled but less accurately, so the word lists stay the first check. Jev costs $0.042 per million input tokens, output is free; the model is pinned (`TYPESAFE_MODEL_ID`, default `jev-1.14.0`).

The contract is a domain function built on the `@lib/utils` shape guards, not a Zod schema. [`validation.md`](../rules/validation.md) reserves Zod for the presentation boundary, and AI output arrives in infrastructure. A domain function can be called from the provider adapter and tested without a provider.

## Shape (version 1)

Every output is one JSON object. The AI never chooses the kind or the hint level. It echoes the values it was asked for, and the backend rejects anything else.

| Field          | Type                                       | Kinds                    | Rule                                                                     |
| -------------- | ------------------------------------------ | ------------------------ | ------------------------------------------------------------------------ |
| `version`      | `1`                                        | all                      | exactly the current contract version                                     |
| `kind`         | see below                                  | all                      | allowlisted, and equal to the requested kind                             |
| `hintLevel`    | see below                                  | all                      | allowlisted, and equal to the requested level                            |
| `competencyId` | string                                     | all, optional            | `^[a-z0-9][a-z0-9._-]{0,63}$`; optional until curriculum ingestion (#28) |
| `text`         | string                                     | all                      | trimmed, not empty, within the kind's maximum length, plain text only    |
| `result`       | `correct` \| `partly_correct` \| `not_yet` | `answer_assessment` only | allowlisted; any other value, or the field on another kind, is rejected  |

No other field is allowed. An unknown field rejects the whole output; it is not silently dropped.

### Kinds and maximum text length

Lengths count characters (code points), so an emoji counts as one.

| Kind                     | Purpose                                                   | Max length | Extra rule        |
| ------------------------ | --------------------------------------------------------- | ---------- | ----------------- |
| `thinking_prompt`        | a question that helps the child think                     | 200        |                   |
| `hint`                   | a graduated hint at the requested level                   | 280        |                   |
| `praise`                 | specific praise for what the child did well               | 160        |                   |
| `comprehension_question` | checks that the child understood their own correct answer | 160        | must end with `?` |
| `answer_assessment`      | assesses the child's own answer, without the solution     | 200        | requires `result` |

### Hint levels

The hint ladder from #30, lowest help first. No level reveals the solution. The type lives in `src/modules/guidance/domain/models/hint-level.ts` and is shared with the orchestration (#10) and the ladder (#30).

| Level                      | Meaning                                             |
| -------------------------- | --------------------------------------------------- |
| `understand_task`          | What is the task asking?                            |
| `activate_prior_knowledge` | What do you already know that helps?                |
| `next_step`                | Points to the next step, not the result             |
| `similar_example`          | A worked example on a similar but different problem |

### Text rules

The text is shown, and may be read aloud, as plain text. It must not contain:

- **Links**: any `scheme://`, `javascript:`, `data:`, `mailto:`, `tel:`, `file:` or `vbscript:`, `www.`, or a bare domain with a common top-level domain (`.de`, `.com`, `.ai`, …). The brand name `Hort.ai` is a bare domain too and is therefore rejected; the AI has no reason to name it.
- **Markup**: HTML tags (`<b>`, `<!--`), HTML entities (`&amp;`), Markdown links and images, `**`, `~~`, headings and block quotes. `__` stays allowed because worksheets mark a blank with it (`3 + __ = 7`), and `<` before a digit or a space is a comparison (`5 < 7`).
- **Code**: backticks, `{` or `}`, `=>`, and calls such as `eval(` or `document.`.
- **Invisible characters**: control characters other than a line break, zero-width characters and bidirectional overrides.

## Rejection

`validateAiOutput` returns `Result<AiOutput, ValidationAppError>`. A rejection has `kind: 'validation'`, `code: 'guidance.ai_output_rejected'`, and `fieldErrors` listing every violation by field. A violation of the output as a whole is reported under `$`. An output that is not an object, has another version or has an unknown kind stops at that first finding; otherwise every field is checked and all violations are returned together.

| Code                                            | Meaning                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `guidance.ai_output.not_an_object`              | not a plain JSON object (array, string, null, …)                    |
| `guidance.ai_output.unsupported_version`        | `version` missing or not `1`                                        |
| `guidance.ai_output.unknown_kind`               | `kind` outside the allowlist                                        |
| `guidance.ai_output.unexpected_kind`            | an allowlisted kind other than the requested one                    |
| `guidance.ai_output.unknown_field`              | a field the kind does not allow                                     |
| `guidance.ai_output.missing_field`              | `kind`, `hintLevel`, `text` or (for an assessment) `result` missing |
| `guidance.ai_output.invalid_type`               | `text` is not a string                                              |
| `guidance.ai_output.invalid_hint_level`         | `hintLevel` outside the ladder                                      |
| `guidance.ai_output.unexpected_hint_level`      | a ladder level other than the requested one                         |
| `guidance.ai_output.invalid_competency_id`      | `competencyId` present but not a short identifier                   |
| `guidance.ai_output.invalid_assessment_result`  | `result` outside `correct`, `partly_correct`, `not_yet`             |
| `guidance.ai_output.text_empty`                 | `text` empty after trimming                                         |
| `guidance.ai_output.text_too_long`              | `text` longer than the kind allows                                  |
| `guidance.ai_output.not_a_question`             | a comprehension question that does not end with `?`                 |
| `guidance.ai_output.contains_control_character` | invisible or control characters                                     |
| `guidance.ai_output.contains_url`               | a link                                                              |
| `guidance.ai_output.contains_markup`            | HTML or Markdown                                                    |
| `guidance.ai_output.contains_code`              | code                                                                |
| `guidance.ai_output.solution_leaked`            | the solution-leak guard (#31) rejected the text, see below          |

These codes are stable. Renaming one is a breaking change of the contract and bumps its version.

## Examples

All examples answer a request for `{ kind: 'hint', hintLevel: 'next_step' }` unless stated otherwise. The child's task is "23 + 24 = ?".

### Valid

```json
{
  "version": 1,
  "kind": "hint",
  "hintLevel": "next_step",
  "text": "Rechne zuerst die Zehner zusammen: Wie viel ist 20 + 20?"
}
```

```json
{
  "version": 1,
  "kind": "hint",
  "hintLevel": "next_step",
  "competencyId": "de-by.m.2.addition-bis-100",
  "text": "Welche Zahl gehört in die Lücke: 3 + __ = 7?"
}
```

Request `{ kind: 'answer_assessment', hintLevel: 'understand_task' }`, child answered 41:

```json
{
  "version": 1,
  "kind": "answer_assessment",
  "hintLevel": "understand_task",
  "result": "not_yet",
  "text": "Die Zehner stimmen schon. Schau dir die Einer noch einmal an."
}
```

Request `{ kind: 'comprehension_question', hintLevel: 'understand_task' }`:

```json
{
  "version": 1,
  "kind": "comprehension_question",
  "hintLevel": "understand_task",
  "text": "Warum hast du hier addiert und nicht subtrahiert?"
}
```

### Invalid

| Output (abridged)                                                     | Rejected with                                               |
| --------------------------------------------------------------------- | ----------------------------------------------------------- |
| `{ "version": 1, "kind": "solution", … }`                             | `kind: unknown_kind`                                        |
| `{ … "kind": "praise", … }` (a hint was requested)                    | `kind: unexpected_kind`                                     |
| `{ … "hintLevel": "similar_example", … }` (`next_step` was requested) | `hintLevel: unexpected_hint_level`                          |
| `{ … "hintLevel": 3, … }`                                             | `hintLevel: invalid_hint_level`                             |
| `{ …, "answer": "47" }`                                               | `answer: unknown_field`                                     |
| `{ …, "nextHintLevel": "similar_example" }`                           | `nextHintLevel: unknown_field` (the AI never decides state) |
| `{ "version": 2, … }`                                                 | `version: unsupported_version`                              |
| `[{ … }]`                                                             | `$: not_an_object`                                          |
| `"text": "Schau auf www.mathe-loesungen.de nach."`                    | `text: contains_url`                                        |
| `"text": "<b>Denk nach!</b>"`                                         | `text: contains_markup`                                     |
| ``"text": "Tipp: `20 + 20`"``                                         | `text: contains_code`                                       |
| `"text": ""`                                                          | `text: text_empty`                                          |
| `"result": "solved"` on an assessment                                 | `result: invalid_assessment_result`                         |
| `"result": "correct"` on a hint                                       | `result: unknown_field`                                     |

### Leaking the solution

These outputs are valid by shape, so this contract accepts them. The solution-leak guard (#31) rejects them with `guidance.ai_output.solution_leaked`, because only it knows the task and its solution.

| Output text                                                     | Why it leaks                                   |
| --------------------------------------------------------------- | ---------------------------------------------- |
| `Das Ergebnis ist 47.`                                          | the final numeric result                       |
| `20 + 20 = 40, 3 + 4 = 7, also 47.`                             | a fully worked solution of the same problem    |
| `Fast! Richtig wäre 47.` (an assessment with `result: not_yet`) | an assessment that reveals the expected answer |
| `Schreib: Tom hat 47 Murmeln.`                                  | a complete answer sentence for a text task     |

A hint at `similar_example` uses a different problem (for example 34 + 13) and does not leak, as long as it never computes the child's own task.

### The solution-leak guard (#31)

`findSolutionLeaks` (`domain/solution-leak/`) runs in `judgeAiAnswer` on every validated output, hints and answer feedback alike, before the word lists and before the safety classifier, so a leaking text never leaves the backend. It is deterministic and needs no AI; a later check may only reject more. It knows the child's task, the teacher's solution key of an assignment (#33) and, for feedback, the child's own answer. None of these is sent to the AI.

What the guard treats as the solution:

- the value of a written expression in the task (`23 + 24`, `3 · 4 + 5`, `12 : 3`, `6 mal 7`), point before line;
- for a word problem without an expression, every sum, difference, product, exact quotient and the total of its numbers (2 to 4 numbers; 0 and 1 are too common to count): stricter than needed, never weaker;
- the numbers of the teacher's key, or the words of a text key (without fillers such as `der`, `und`).

A number the task itself shows is not a result, so a hint may repeat the task. Numbers are read as digits, with a decimal comma, or spelled out (`siebenundvierzig`, `zweihundertdrei`); `ein` and `eine` are articles, only `eins` is the number.

| Detail code                               | Rejects                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `guidance.solution_leak.states_result`    | a result, even inside a "similar" example that gives the same number (`30 + 17 = 47`)                               |
| `guidance.solution_leak.announces_result` | any number presented as the result (`Die Lösung lautet 12`, `Richtig wäre 47`), whether or not the result is known  |
| `guidance.solution_leak.dictates_answer`  | telling the child what to write (`Schreib: …`)                                                                      |
| `guidance.solution_leak.works_the_task`   | more correct steps on the task's numbers or their place values than the level allows: one at `next_step`, else none |
| `guidance.solution_leak.reveals_key_text` | every word of a text key; words the task lists as options count too, because naming one is choosing it              |

Praise and the comprehension question are only worded after a correct answer, so they may repeat a number the child wrote. A hit becomes the fallback reason `solution_leaked` with the predefined text of the requested kind and level, logged as `guidance.hint_fallback_used` or `guidance.feedback_fallback_used` with `guidance.ai_output.solution_leaked` and the detail codes, never with the text, the task, the answer or the key. Hints get the key through `HintOrchestrator.suggest(request, solutionKey)`; until assignments reach the hint request, hints are checked against the task alone.

Known limits: a result in a paraphrase the guard cannot compute (`vierzig plus sieben` without `=`) passes, and for a text answer without a teacher's key only announced or dictated answers are caught. Both are prompt rules too (`domain/prompt/base-rules.ts`).

## Changing the contract

1. Change the types and checks in `src/modules/guidance/domain/ai-output/` and their tests.
2. A breaking change (a removed or renamed field, kind, hint level or code) bumps `AI_OUTPUT_CONTRACT_VERSION`. The prompt and the provider adapter (#10) must change in the same pull request.
3. Update this document, including the examples.

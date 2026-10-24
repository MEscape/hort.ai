# Product vision

This document owns the agreed product requirements for Hort.ai. Read it before planning, implementing or reviewing features. The [concept overview](flows.md) illustrates the intended experience and labels proposals separately; it does not establish a final architecture. Requirements describe the target product, not features already implemented in the repository.

This vision builds on [PR #36](https://github.com/MEscape/hort.ai/pull/36) and the product decisions confirmed on 2026-10-24. It supersedes earlier learning-path, XP and exercise-app assumptions, including examples in design documentation. [Engineering rules](../rules/README.md) govern implementation; a gallery or mockup cannot add product requirements.

## What Hort.ai is

Hort.ai helps primary-school children with homework and test preparation when their parents do not have time to help. The child works on a real task from school. Hort.ai helps them understand it, think through the next step and check their own answer. **Hort.ai never solves the child's task for them.**

Hort.ai offers no exercises, missions, lessons or learning paths of its own. A hint may use a similar but different worked example to support the child's current task, and comprehension questions check that task's understanding. These are contextual help, not a separate exercise offering, and must not reveal the original task's solution.

## Roles and access

| Role    | Intended experience and access                                                                                                                                                                           |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Child   | Primary-school grades 1 to 4 across German federal states. Works on a school task by text and, where available, voice under a profile selected by the parent.                                            |
| Parent  | Creates and manages their child's profile, links it to a class and sees a short summary of where the child needed help. Access is limited to their own children.                                         |
| Teacher | Creates their own classes, invites children, optionally uploads class material and posts teacher-written assignments. Sees learning summaries only for children in those classes, never raw transcripts. |

Child-facing content is German. Existing English and German catalogs must remain consistent. The current `defaultLocale` is still `en`; this product decision does not change routing or configuration by itself.

## Homework help session

1. The child enters a school task, chooses an assignment from their teacher or resumes an unfinished task.
2. Hort.ai offers a thinking prompt to help the child understand the task.
3. When the child asks for help, hints progress from understanding the task, through prior knowledge and the next step, to a similar but different worked example. No level reveals the solution.
4. The child gives their own answer. Feedback distinguishes correct, partly correct and not yet; another attempt returns to help rather than disclosing the solution.
5. Good work receives specific, proportionate praise. A comprehension question checks understanding before the task is treated as understood.
6. The session is saved so the child can continue later, including after signing in again.

When a teacher solution key exists, answer checking uses it deterministically. Otherwise an AI assessment is a proposal that the backend must validate. Textual similarity alone does not establish correctness. Solution keys stay backend-only and must not be exposed in child-facing text or speech.

## Curriculum and teacher material

- Relevant competencies come from official curricula for the child's federal state, grade and subject, with traceable source references and versions.
- Teacher uploads provide additional context only to children in the permitted class. Deleted material must no longer be used.
- Retrieved document text and child input are untrusted data; neither may override product or safety rules.
- Assignments are written by teachers, never created or modified by the AI.

## AI and companion requirements

- The backend is the source of truth for sessions, hint levels, answer outcomes, roles and access. AI output cannot change state directly.
- AI output is untrusted until it satisfies the allowed data contract, content requirements and solution protection. Unsafe, invalid or solution-revealing output is replaced by a safe fallback.
- These requirements apply equally to displayed text, spoken output and every companion. No persona or channel may bypass them.
- Children choose one predefined companion: Max the dog, Lili the rabbit or Fina the dragon. Each combines appearance, personality and voice; the child does not assemble the parts freely.
- Persona changes tone, wording and examples only. It cannot change correctness, access, hint policy or safety requirements.
- Characters, brief celebrations and animation may be playful and encouraging. There are no XP, points, badges, levels, streaks, rankings or reward systems.
- Help remains available without depending on animation, sound or a particular character. Mistakes and requests for hints are never punished.

These are observable product requirements, not a prescribed internal processing sequence. Responsibility boundaries still follow the engineering rules. The concrete AI processing chain remains undecided.

## MVP data and persistence

The child's MVP profile contains a display name, federal state, grade and selected companion. Interests and parent-defined learning goals are deferred. Authentication, class membership, session state and learning events are separate concerns; limiting profile fields does not mean those necessary records disappear.

The MVP saves the state required to resume help and records deduplicated learning events for the agreed summaries: competencies, attempts, hint levels, comprehension checks and completion. Summaries do not rank children or infer mastery from praise alone. Teacher views contain permitted aggregates, not raw transcripts. Diagnostic and audit logs must not contain raw child input or conversation content.

A parent-facing storage-off switch is deferred beyond the MVP. Do not promise a storage-free mode while relying on persistent sessions or learning analysis. This does not remove the need to define access, deletion and retention behavior for the data the application actually stores.

The choice between stored session state, event-derived state or another persistence design remains open. An append-only event log, replay mechanism or particular database schema is not mandated by the concept diagrams.

## MVP scope and deferred features

The first complete slice covers one subject and a selected grade range in at least one federal state; the particular slice is decided in issue #5. The broader audience remains grades 1 to 4 across federal states. Do not turn that audience into a requirement to ingest every curriculum before the first slice works.

Deferred beyond the MVP:

- Interests, parent-defined learning goals and the storage-off switch.
- Automatic inference of frustration or other emotional signals; friendly wording and companion expressions remain allowed.
- Alexa, school-administration integrations and multiple children sharing one device or Echo.
- Photo or worksheet recognition and image generation.

Own exercise offerings and gamification contradict the product direction; they are not merely deferred features.

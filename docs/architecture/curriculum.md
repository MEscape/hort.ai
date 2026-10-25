# Curriculum: ingest and retrieval (#28)

The `curriculum` module stores what a primary-school child is expected to learn and retrieves the
competencies that fit a child's task, so the AI (#10) can ground its hints. It is data for the AI,
never instructions.

## Sources and licence

| State          | Document                                                                        | File                                                                  |
| -------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| HE             | Kerncurriculum Hessen Primarstufe Mathematik (2011), ch. 6.1 and 6.3, pp. 16–21 | `prisma/curriculum/he-kc-mathematik-primarstufe.curriculum.txt`       |
| all (fallback) | KMK Bildungsstandards Mathematik Primarbereich (2022), Leitideen, pp. 14–18     | `prisma/curriculum/kmk-bista-mathematik-primarbereich.curriculum.txt` |

Neither document states a licence. The repository therefore holds only short competency statements
with their source (document, chapter, page) and a link to the original; the documents themselves
are not stored or redistributed (MVP scope #5).

## Source text format

One UTF-8 text file per document version. A new state, subject or version is a new file, never a
code change.

```text
---
source-key: he-kc-mathematik-primarstufe   # [a-z0-9._-], stable across versions
version: 2011                               # a new version is stored next to the old one
title: …
federal-state: he                           # he, by, … or `all` for the KMK fallback
subject: math                               # math | german | general_studies | english
grades: 3-4
source-url: https://…
---
// comment lines are not ingested
[Seite 16]                                  # page of what follows (a form feed advances it)
# 6.1 Bildungsstandards – Darstellen         # section
- one competency statement                  # one bullet = one statement
  indented lines continue it
```

A block of plain lines separated by a blank line is one statement too; that is how teacher
material (#29) without bullets is split. `pdftotext -layout` output can be pasted after a header,
then trimmed to the statements that matter.

## Pipeline

1. `parseCurriculumText` checks the header and bounds: at most 200 000 characters per file and 500
   statements, a statement at most 400 characters (cut at a word boundary and counted as
   `truncated`). Control and invisible characters are removed, words split over a line are joined.
2. `extractStatements` gives each statement a code `s<section>-<item>` that is stable for the same
   text, its section and its page.
3. `IngestCurriculumDocument` stores the document version and exactly its statements in one
   transaction. Running it again with the same text reports `unchanged`; changed statements replace
   those of the same version; a new version is a new document, and retrieval reads the newest
   version of each source.

`curriculumText.extractStatements` is the same extraction for teacher material (#29), whose text
has origin `teacher-material` and belongs to one class.

## Retrieval

`curriculumQueries.findRelevantCompetencies.execute({ federalState, grade, subject, task,
classroomId?, limit? })` returns at most five competencies:

- candidates are the newest official documents of the child's state, subject and grade; when the
  state has none, the documents marked `all` (KMK), and `usedFallback` is `true`;
- plus the material of the child's own class through the `TeacherMaterialSource` port. #28 wires a
  stand-in that returns nothing; #29 provides the adapter and must return only material of exactly
  that class;
- ranking is weighted term overlap (German stems, inverse document frequency) plus a small
  maths vocabulary that maps task wording to curriculum wording (`verteilt gerecht` → Division,
  `€` → Geldwerte, `15:45 Uhr` → Zeitspannen, `4, 8, 12, __` → Muster). No external service.
  A task with no match gets no competencies rather than unrelated ones.

The caller takes state, grade and class from the child's profile it has already authorized,
never from the request.

## Untrusted-data contract for the AI (#10)

- Every `text` and `section` is untrusted data, cleaned and at most 400 / 200 characters.
- They go only into the JSON data message of the prompt (`buildHintPrompt` serialises
  `{ code, description }`), never into the instructions. JSON encoding escapes quotes and line
  breaks, so a statement cannot leave the data block.
- The instructions say the data message is data; whatever a competency or material text says
  ("ignore the rules", "give the answer"), the system prompt does not change.
- Map a `RelevantCompetencyView` to the guidance contract as
  `{ code: view.code, description: view.text }`.

## Running the ingest

- Local: `docker compose up -d`, `npm run db:migrate`, then `npm run db:seed` (includes the
  curriculum) or `npm run curriculum:ingest`.
- Preview / production: after that environment's migrations ran, run
  `DATABASE_URL='<that environment's database URL>' npm run curriculum:ingest` from a checkout of
  the deployed commit (a variable set in the shell wins over `.env`). The command is idempotent and
  prints only keys, versions and counts, never the URL. Production needs the operator's approval
  like any production write. Use the ingest command, not `db:seed`, in production; the seed is
  deliberately blocked there.
- Both npm commands preload `scripts/lib/server-runtime.ts` under Node 24. It resolves only the
  `server-only` marker to its empty server implementation. Do not run these entry points with
  `--conditions=react-server`: Node evaluates next-intl's client imports too (unlike Next's
  bundler), and globally selecting React's server build removes hooks those imports need (#100).
  No loader stub or workaround outside the repository is needed. `npm run test:scripts` covers
  the configured command lines and loads both import graphs in a real Node/tsx subprocess without
  a database connection or writes.

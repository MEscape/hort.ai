# MVP scope (#5)

Status: decided on 2026-10-24 ([#5](https://github.com/MEscape/hort.ai/issues/5)). Read together with the product vision (`docs/product/vision.md`). Supersedes the learning-path decision of the closed PR #26 (counting apples, XP), which no longer fits the vision.

## Slice

| Item                  | Decision                                                                       | Why                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Subject               | Mathematics                                                                    | Answers are checkable deterministically by the backend, so a solution leak can be detected reliably (#14, #31).              |
| Grades                | 3 and 4 (one double grade, the way the Hessian curriculum groups competencies) | Matches the mockups' target child (about 8 years). Homework at this level has several steps, so a hint ladder is meaningful. |
| Federal state         | Hessen (`HE`)                                                                  | The hackathon is in Fulda; the jury knows this curriculum. Further states are data, not code (#28).                          |
| Child-facing language | German                                                                         |                                                                                                                              |

Grades 1 to 4 and all 16 federal states stay the product target. The data model stores federal state and grade for every child, class and competency from day one.

## Curriculum sources

| State          | Document                                                                                                                                                                      | Source                                                                                                              | Terms                                                                                                                                                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HE             | Kerncurriculum für Hessen, Primarstufe, Mathematik (2011), Kapitel 6.1 Bildungsstandards und Inhaltsfelder am Ende der Jahrgangsstufe 4, Kapitel 6.2 Kompetenzentwicklung 1/2 | https://kultus.hessen.de/sites/kultus.hessen.de/files/2021-06/kc_mathematik_prst_2011.pdf                           | Public document of the Hessian Ministry of Education. We store short competency statements with a source reference (document, chapter, page) and link to the original; we do not republish the document. Licence not stated explicitly ❓, so no full-text redistribution. |
| all (fallback) | KMK Bildungsstandards Mathematik Primarbereich (23.06.2022)                                                                                                                   | https://www.kmk.org/fileadmin/Dateien/veroeffentlichungen_beschluesse/2022/2022_06_23-Bista-Primarbereich-Mathe.pdf | Same handling. Used for a state that has no ingested curriculum yet.                                                                                                                                                                                                       |

Teacher uploads (#29) come on top and only ground the children of that teacher's class.

Competency granularity for the MVP: one competency per Bildungsstandard bullet (process competencies) and per Inhaltsfeld focus (content: Zahl und Operation, Größen und Messen, Muster und Strukturen, Raum und Form, Daten und Zufall), tagged `state=HE`, `grades=3-4`, `subject=math`.

## Roles in the MVP

- **Parent** signs up, creates a child profile (display name, federal state, grade, interests, companion, parent controls; every control starts at its most private value) after confirming guardianship and links it to a class with an invite code.
- **Teacher** signs up by choosing the teacher role at registration (no verification in the MVP, documented risk). Creates a class (federal state, grade, subject), gets an invite code, may upload material (#29) and post assignments (#33).
- **Child** has no account. It works in the parent's session on its own task or an open assignment of its class. A child belongs to at most one active class; the class's federal state and grade are copied to the profile when it joins.

## Sample homework (test data, not offered to children)

These are tasks a teacher could have set. Hort.ai never offers them on its own. Ladder levels follow the vision: 1 understand the task, 2 activate prior knowledge, 3 next step, 4 worked example on a similar but different task. No level contains the expected answer or a step that yields it directly.

### S1 Division in context

- Task: „Lisa hat 36 Murmeln. Sie verteilt sie gerecht an 4 Kinder. Wie viele Murmeln bekommt jedes Kind?“
- Expected answer: 9 (Murmeln)
- Competency: Zahl und Operation; Modellieren (Sachproblem in Mathematik übersetzen)
- Ladder: 1 „Was sollst du herausfinden? Wer bekommt etwas?“ · 2 „Was bedeutet ‚gerecht verteilen‘? Welche Rechenart passt dazu?“ · 3 „Welche Malaufgabe mit 4 kennst du, die zur Zahl der Murmeln passt?“ · 4 „Beispiel: 20 Äpfel gerecht an 5 Kinder. 5 · 4 = 20, also bekommt jedes Kind 4 Äpfel. Probier es jetzt mit deinen Zahlen.“
- Comprehension question: „Wie kannst du prüfen, ob dein Ergebnis stimmt?“

### S2 Addition up to 1000

- Task: „Rechne: 347 + 256“
- Expected answer: 603
- Competency: Zahl und Operation (halbschriftliche/schriftliche Verfahren)
- Ladder: 1 „Welche Zahlen sollst du zusammenrechnen?“ · 2 „Wie zerlegst du eine Zahl in Hunderter, Zehner und Einer?“ · 3 „Fang mit den Hundertern an. Was ergeben die beiden Hunderter zusammen?“ · 4 „Beispiel: 125 + 132 = 100 + 100, 20 + 30, 5 + 2 → 200 + 50 + 7 = 257.“
- Comprehension question: „Was machst du, wenn die Einer zusammen mehr als 9 ergeben?“

### S3 Money

- Task: „Ein Heft kostet 2 € 50 ct. Tim kauft 3 Hefte. Wie viel muss er bezahlen?“
- Expected answer: 7,50 € (7 € 50 ct)
- Competency: Größen und Messen (Geldwerte); Zahl und Operation
- Ladder: 1 „Was kauft Tim, und wie viele davon?“ · 2 „Wie viele Cent sind ein Euro?“ · 3 „Rechne erst die Euro, dann die Cent für alle Hefte.“ · 4 „Beispiel: 2 Stifte zu je 1 € 20 ct → 2 € und 40 ct = 2,40 €.“
- Comprehension question: „Würden 7 € reichen? Warum?“

### S4 Time spans

- Task: „Der Film beginnt um 15:45 Uhr und dauert 50 Minuten. Wann ist er zu Ende?“
- Expected answer: 16:35 Uhr
- Competency: Größen und Messen (Zeitspannen)
- Ladder: 1 „Wann beginnt der Film, und wie lange dauert er?“ · 2 „Wie viele Minuten hat eine Stunde?“ · 3 „Wie viele Minuten sind es von 15:45 bis zur vollen Stunde?“ · 4 „Beispiel: Start 10:50, Dauer 30 Minuten: 10 Minuten bis 11:00, dann noch 20 → 11:20.“
- Comprehension question: „Wie hast du die volle Stunde genutzt?“

### S5 Patterns

- Task: „Setze die Zahlenfolge fort: 4, 8, 12, 16, __, __“
- Expected answer: 20, 24
- Competency: Muster und Strukturen
- Ladder: 1 „Wie viele Zahlen fehlen?“ · 2 „Vergleiche zwei Nachbarzahlen. Was fällt dir auf?“ · 3 „Um wie viel wird jede Zahl größer?“ · 4 „Beispiel: 3, 6, 9 → immer +3, also 12, 15.“
- Comprehension question: „Welche Regel steckt in der Folge? Erkläre sie in einem Satz.“

## Out of scope for the MVP

Other subjects, grades 1 and 2 content, states other than Hessen (beyond the KMK fallback), photo upload, generated exercises, gamification, Alexa, emotional signals, multiple children on one device.

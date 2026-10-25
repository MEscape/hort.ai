/** Retrieval bounds (performance.md): every list is capped. */
export const RELEVANT_COMPETENCIES_DEFAULT = 3;
export const RELEVANT_COMPETENCIES_MAX = 5;
/** Candidates loaded per source; a curriculum slice has some dozens. */
export const CANDIDATES_MAX = 500;
/** Teacher material sections loaded for one class. */
export const MATERIAL_SECTIONS_MAX = 200;
/** Characters of the task text that retrieval reads; matches the child task text limit (#11). */
export const TASK_TEXT_MAX = 1000;
/** Competency codes named per call (#35); a summary names about ten sessions. */
export const COMPETENCY_DESCRIPTIONS_MAX = 20;
/** A retrieval code (`<sourceKey>@<version>:<code>`) longer than this is not looked up. */
export const COMPETENCY_CODE_MAX_LENGTH = 300;

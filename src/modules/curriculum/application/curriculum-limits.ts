/** Retrieval bounds (performance.md): every list is capped. */
export const RELEVANT_COMPETENCIES_DEFAULT = 3;
export const RELEVANT_COMPETENCIES_MAX = 5;
/** Candidates loaded per source; a curriculum slice has some dozens. */
export const CANDIDATES_MAX = 500;
/** Teacher material sections loaded for one class. */
export const MATERIAL_SECTIONS_MAX = 200;
/** Competency codes one description lookup reads; a summary names far fewer topics. */
export const DESCRIBED_CODES_MAX = 100;
/** Characters of the task text that retrieval reads; matches the child task text limit (#11). */
export const TASK_TEXT_MAX = 1000;

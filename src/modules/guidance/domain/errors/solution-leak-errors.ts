/**
 * Why a validated AI text was not shown: it would have handed the child the solution (#31). Logged
 * as codes beside `guidance.ai_output.solution_leaked`, never with the text, the task or the key.
 */
export const SOLUTION_LEAK_VALIDATION_CODES = {
  /** The text contains the result of the child's task or a number of the teacher's key. */
  statesResult: 'guidance.solution_leak.states_result',
  /** The text presents a number as the result ("Die Lösung ist 12"), known solution or not. */
  announcesResult: 'guidance.solution_leak.announces_result',
  /** The text tells the child what to write down ("Schreib: …"). */
  dictatesAnswer: 'guidance.solution_leak.dictates_answer',
  /** The text computes more steps of the child's own task than the hint level allows. */
  worksTheTask: 'guidance.solution_leak.works_the_task',
  /** The text contains the words of the teacher's key for a text answer. */
  revealsKeyText: 'guidance.solution_leak.reveals_key_text',
} as const;

export type SolutionLeakValidationCode =
  (typeof SOLUTION_LEAK_VALIDATION_CODES)[keyof typeof SOLUTION_LEAK_VALIDATION_CODES];

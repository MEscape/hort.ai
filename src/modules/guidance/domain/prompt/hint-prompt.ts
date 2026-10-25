import { AI_OUTPUT_CONTRACT_VERSION, AI_TEXT_MAX_LENGTH } from '../ai-output/ai-output';

import { BASE_RULES } from './base-rules';

import type { HintLevel } from '../models/hint-level';
import type { HintRequest } from '../models/hint-request';

/**
 * What a provider adapter sends to the model for one hint. `instructions` is the system prompt and
 * never contains anything the child wrote; `data` carries the task and the curriculum as JSON and
 * goes into a separate user message. JSON encoding escapes quotes and line breaks, so a task cannot
 * close the data block and continue as instructions.
 */
export interface HintPrompt {
  readonly instructions: string;
  readonly data: string;
}

/** What each rung asks the model to do (#30). None of them hands over the result. */
const LEVEL_GUIDANCE: Readonly<Record<HintLevel, string>> = {
  understand_task: 'Help the child understand what the task is asking. Do not start solving it.',
  activate_prior_knowledge:
    'Remind the child of something they already know that helps with this task.',
  next_step: 'Point to the next step the child can take themselves. Never state its result.',
  similar_example:
    'Show a worked example on a similar but different problem with different numbers or words.',
};

function instructionsFor(level: HintLevel): string {
  return [
    ...BASE_RULES,
    `This hint is at the level "${level}": ${LEVEL_GUIDANCE[level]}`,
    "The data lists the earlier hints of this session, oldest first, and the result of the child's last answer check (null when there is none). Do not repeat an earlier hint; build on it.",
    `Answer with exactly one JSON object and nothing else: {"version": ${AI_OUTPUT_CONTRACT_VERSION}, "kind": "hint", "hintLevel": "${level}", "text": "<your hint>"}. The text is plain text of at most ${AI_TEXT_MAX_LENGTH.hint} characters, without links, markup or code.`,
  ].join('\n');
}

/**
 * Builds the prompt for one hint (#10, #11). The level comes from the backend; the task, the
 * competencies, the earlier hints and the last answer result enter only as JSON data. The wording
 * of the instructions is owned by the backend lead.
 */
export function buildHintPrompt(request: HintRequest): HintPrompt {
  return {
    instructions: instructionsFor(request.level),
    data: JSON.stringify({
      task: request.task,
      competencies: request.competencies.map(({ code, description }) => ({ code, description })),
      earlierHints: request.earlierHints.map(({ level, text }) => ({ level, text })),
      lastAnswerResult: request.lastAnswerResult,
    }),
  };
}

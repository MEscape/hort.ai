import { describe, expect, it } from 'vitest';

import {
  currentHintLevel,
  nextHintLevel,
} from '@modules/guidance/domain/hint-ladder/next-hint-level';
import type {
  GivenHint,
  HintLadderState,
} from '@modules/guidance/domain/models/help-session-state';
import type { HintLevel } from '@modules/guidance/domain/models/hint-level';
import { parseStepRequestId } from '@modules/guidance/domain/models/ids';

import { REQUEST } from '../fakes';

const hint = (level: HintLevel): GivenHint => ({
  requestId: parseStepRequestId(`hint-${level}`)._unsafeUnwrap(),
  level,
  kind: 'fallback',
  reason: 'timeout',
});

const state = (
  levels: readonly HintLevel[],
  answers: HintLadderState['answers'] = [],
): HintLadderState => ({ task: REQUEST.task, subject: 'math', hints: levels.map(hint), answers });

describe('nextHintLevel (#30)', () => {
  it.each<[readonly HintLevel[], HintLevel]>([
    [[], 'understand_task'],
    [['understand_task'], 'activate_prior_knowledge'],
    [['understand_task', 'activate_prior_knowledge'], 'next_step'],
    [['understand_task', 'activate_prior_knowledge', 'next_step'], 'similar_example'],
    [['similar_example'], 'similar_example'],
    [['similar_example', 'similar_example'], 'similar_example'],
  ])('after %o gives %s', (given, expected) => {
    expect(nextHintLevel(state(given))).toBe(expected);
  });

  it('climbs from the highest hint given, not from the latest', () => {
    expect(nextHintLevel(state(['next_step', 'understand_task']))).toBe('similar_example');
  });

  it('skips "understand the task" once an answer was partly correct', () => {
    expect(nextHintLevel(state([], ['partly_correct']))).toBe('activate_prior_knowledge');
  });

  it('lets "not yet" and unassessed answers start at the bottom rung', () => {
    expect(nextHintLevel(state([], ['not_yet', null]))).toBe('understand_task');
  });

  it('never goes back down because of a partly correct answer', () => {
    expect(nextHintLevel(state(['next_step'], ['partly_correct']))).toBe('similar_example');
  });
});

describe('currentHintLevel', () => {
  it('is "understand the task" before any hint', () => {
    expect(currentHintLevel(state([]))).toBe('understand_task');
  });

  it('is the highest hint given so far', () => {
    expect(currentHintLevel(state(['next_step', 'understand_task']))).toBe('next_step');
  });
});

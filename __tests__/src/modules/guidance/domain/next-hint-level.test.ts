import { describe, expect, it } from 'vitest';

import {
  currentHintLevel,
  nextHintLevel,
} from '@modules/guidance/domain/hint-ladder/next-hint-level';
import type {
  GivenHint,
  HintLadderState,
} from '@modules/guidance/domain/models/help-session-state';
import type { HintFallbackReason } from '@modules/guidance/domain/models/hint-fallback-reason';
import type { HintLevel } from '@modules/guidance/domain/models/hint-level';
import { parseStepRequestId } from '@modules/guidance/domain/models/ids';

import { REQUEST } from '../fakes';

const hint = (level: HintLevel, reason: HintFallbackReason = 'invalid_output'): GivenHint => ({
  requestId: parseStepRequestId(`hint-${level}`)._unsafeUnwrap(),
  level,
  kind: 'fallback',
  reason,
});

const stateOf = (
  hints: readonly GivenHint[],
  answers: HintLadderState['answers'] = [],
): HintLadderState => ({
  task: REQUEST.task,
  assignmentId: null,
  subject: 'math',
  competencyCode: null,
  opening: null,
  hints,
  answers,
});

const state = (levels: readonly HintLevel[], answers: HintLadderState['answers'] = []) =>
  stateOf(
    levels.map((level) => hint(level)),
    answers,
  );

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

  it.each<HintFallbackReason>(['timeout', 'provider_unavailable'])(
    'offers the same rung again after a fallback because of %s',
    (reason) => {
      const given = [hint('understand_task'), hint('activate_prior_knowledge', reason)];

      expect(nextHintLevel(stateOf(given))).toBe('activate_prior_knowledge');
    },
  );

  it('climbs on once a rung fell back twice, so an AI outage never repeats one prompt forever', () => {
    const given = [hint('understand_task', 'timeout'), hint('understand_task', 'timeout')];

    expect(nextHintLevel(stateOf(given))).toBe('activate_prior_knowledge');
    expect(
      nextHintLevel(
        stateOf([
          ...given,
          hint('activate_prior_knowledge', 'provider_unavailable'),
          hint('activate_prior_knowledge', 'provider_unavailable'),
        ]),
      ),
    ).toBe('next_step');
  });

  it.each<HintFallbackReason>(['invalid_output', 'solution_leaked', 'unsafe_output'])(
    'climbs on after a fallback because of %s',
    (reason) => {
      expect(nextHintLevel(stateOf([hint('understand_task', reason)]))).toBe(
        'activate_prior_knowledge',
      );
    },
  );
});

describe('currentHintLevel', () => {
  it('is "understand the task" before any hint', () => {
    expect(currentHintLevel(state([]))).toBe('understand_task');
  });

  it('is the highest hint given so far', () => {
    expect(currentHintLevel(state(['next_step', 'understand_task']))).toBe('next_step');
  });
});

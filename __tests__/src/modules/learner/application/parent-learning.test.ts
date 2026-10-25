import { describe, expect, it } from 'vitest';

import type {
  ParentLearningRecords,
  ParentPeriod,
  ParentTask,
} from '@modules/learner/application/contracts/parent-learning-views';
import { aggregateParentLearning } from '@modules/learner/application/services/aggregate-parent-learning';
import { toParentTaskId } from '@modules/learner/domain/models/ids';

const period: ParentPeriod = {
  range: 'today',
  from: '2026-10-24T22:00:00Z',
  until: '2026-10-25T12:00:00Z',
  today: '2026-10-25',
  days: ['2026-10-25'],
};
const noAnswers = { given: 0, results: { CORRECT: 0, PARTLY_CORRECT: 0, NOT_YET: 0 } };
const task = (overrides: Partial<ParentTask> = {}): ParentTask => ({
  id: toParentTaskId('task-1'),
  assignmentId: null,
  status: 'ACTIVE',
  startedAt: '2026-10-25T10:00:00Z',
  updatedAt: '2026-10-25T11:00:00Z',
  endedAt: null,
  hintCount: 0,
  hintLevels: [],
  answers: noAnswers,
  questionsAsked: 0,
  questionsAnswered: 0,
  subject: 'MATH',
  competencyCode: null,
  ...overrides,
});
const records = (tasks: readonly ParentTask[]): ParentLearningRecords => ({
  tasks,
  assignments: [],
  tasksTruncated: false,
  assignmentsTruncated: false,
});
const id = toParentTaskId;

describe('parent learning metrics', () => {
  it('counts only the stored completed status as finished', () => {
    const result = aggregateParentLearning(
      records([
        task(),
        task({ id: id('2'), status: 'COMPLETED' }),
        task({ id: id('3'), status: 'ABANDONED' }),
      ]),
      period,
    );
    expect(result).toMatchObject({ total: 3, completed: 1, active: 1, abandoned: 1 });
    expect(result.outcomes).toEqual([{ day: '2026-10-25', ACTIVE: 1, COMPLETED: 1, ABANDONED: 1 }]);
  });
  it('counts subjects from the session itself, also for tasks the child brought in', () => {
    const result = aggregateParentLearning(
      records([task(), task({ id: id('2'), subject: 'GERMAN' }), task({ id: id('3') })]),
      period,
    );
    expect(result.subjects).toEqual([
      { subject: 'MATH', count: 2 },
      { subject: 'GERMAN', count: 1 },
    ]);
  });
  it('keeps unavailable hints out of denominators and includes measured zero', () => {
    const result = aggregateParentLearning(
      records([
        task({ hintCount: null }),
        task({ id: id('2'), hintCount: 0 }),
        task({ id: id('3'), hintCount: 2, questionsAnswered: 1 }),
      ]),
      period,
    );
    expect(result).toMatchObject({
      hintedTasks: 1,
      hintTotal: 2,
      insightTasks: 2,
      answeredTasks: 1,
    });
    expect(result.hintDistribution).toEqual([
      { hints: 0, tasks: 1 },
      { hints: 2, tasks: 1 },
    ]);
    expect(result).not.toHaveProperty('mastery');
    expect(result).not.toHaveProperty('recommendations');
  });
  it('counts each rung of the hint ladder once per task, in ladder order', () => {
    const result = aggregateParentLearning(
      records([
        task({ hintCount: 3, hintLevels: ['UNDERSTAND_TASK', 'NEXT_STEP'] }),
        task({ id: id('2'), hintCount: 1, hintLevels: ['NEXT_STEP'] }),
        task({ id: id('3'), hintCount: null }),
      ]),
      period,
    );
    expect(result.helpLevels).toEqual([
      { level: 'UNDERSTAND_TASK', tasks: 1 },
      { level: 'ACTIVATE_PRIOR_KNOWLEDGE', tasks: 0 },
      { level: 'NEXT_STEP', tasks: 2 },
      { level: 'SIMILAR_EXAMPLE', tasks: 0 },
    ]);
  });
  it('counts own answers per task with their own denominator', () => {
    const result = aggregateParentLearning(
      records([
        task({ answers: { given: 2, results: { CORRECT: 1, PARTLY_CORRECT: 0, NOT_YET: 1 } } }),
        task({
          id: id('2'),
          answers: { given: 1, results: { CORRECT: 0, PARTLY_CORRECT: 0, NOT_YET: 1 } },
        }),
        task({ id: id('3') }),
        task({ id: id('4'), answers: null }),
      ]),
      period,
    );
    expect(result).toMatchObject({ answerKnownTasks: 3, ownAnswerTasks: 2, correctTasks: 1 });
  });
  it('uses Berlin calendar dates at the autumn clock change', () => {
    const result = aggregateParentLearning(
      records([task({ startedAt: '2026-10-24T22:30:00Z' })]),
      period,
    );
    expect(result.outcomes).toEqual([{ day: '2026-10-25', ACTIVE: 1, COMPLETED: 0, ABANDONED: 0 }]);
  });
  it('returns real zeros and no distributions for an empty period', () => {
    const result = aggregateParentLearning(records([]), period);
    expect(result.total).toBe(0);
    expect(result.hintDistribution).toEqual([]);
    expect(result.helpLevels).toEqual([]);
    expect(result.subjects).toEqual([]);
    expect(result).toMatchObject({ answerKnownTasks: 0, ownAnswerTasks: 0, correctTasks: 0 });
  });
});

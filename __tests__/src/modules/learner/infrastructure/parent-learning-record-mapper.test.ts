import { describe, expect, it } from 'vitest';

import { toParentTask } from '@modules/learner/infrastructure/prisma/parent-learning-record-mapper';
import type { TaskRecord } from '@modules/learner/infrastructure/prisma/parent-learning-record-mapper';

/** Prisma reads `DateTime` as a `Temporal.Instant`; the mapper uses only its epoch milliseconds. */
const at = (iso: string) => ({ epochMilliseconds: Date.parse(iso) });
const LIMIT = 3;
const record = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
  id: 'session-1',
  assignmentId: null,
  status: 'COMPLETED',
  subject: 'MATH',
  competencyCode: 'kmk-mathe@2022:z.1',
  startedAt: at('2026-10-25T10:00:00Z'),
  updatedAt: at('2026-10-25T10:20:00Z'),
  endedAt: at('2026-10-25T10:20:00Z'),
  hintEvents: [{ level: 'NEXT_STEP' }, { level: 'UNDERSTAND_TASK' }, { level: 'NEXT_STEP' }],
  childAnswers: [{ id: 'a' }, { id: 'b' }],
  answerAssessments: [{ result: 'NOT_YET' }, { result: 'CORRECT' }],
  comprehensionQuestions: [{ repliedAt: at('2026-10-25T10:19:00Z') }, { repliedAt: null }],
  ...overrides,
});

describe('parent task projection', () => {
  it('keeps distinct hint rungs in ladder order and counts answer checks by result', () => {
    expect(toParentTask(record(), true, LIMIT)).toMatchObject({
      hintCount: 3,
      hintLevels: ['UNDERSTAND_TASK', 'NEXT_STEP'],
      answers: { given: 2, results: { CORRECT: 1, PARTLY_CORRECT: 0, NOT_YET: 1 } },
      questionsAsked: 2,
      questionsAnswered: 1,
      evidencePartial: false,
    });
  });
  it('shows no evidence at all while help notes are off', () => {
    expect(toParentTask(record(), false, LIMIT)).toMatchObject({
      hintCount: null,
      hintLevels: [],
      answers: null,
      questionsAsked: null,
      questionsAnswered: null,
      evidencePartial: false,
    });
  });
  it('reports truncated evidence as unavailable instead of an undercount', () => {
    const many = record({ childAnswers: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] });
    const task = toParentTask(many, true, LIMIT);
    expect(task.answers).toBeNull();
    expect(task.hintCount).toBe(3);
    expect(task.evidencePartial).toBe(true);
  });
  it('ignores an assessment result this build does not know', () => {
    const task = toParentTask(
      record({ answerAssessments: [{ result: 'EXCELLENT' }] }),
      true,
      LIMIT,
    );
    expect(task.answers?.results).toEqual({ CORRECT: 0, PARTLY_CORRECT: 0, NOT_YET: 0 });
  });
  it('never carries text from the conversation', () => {
    const task = toParentTask(record(), true, LIMIT);
    expect(JSON.stringify(task)).not.toMatch(/taskText|replyText|"text"/);
  });
  it('passes the curriculum code on for the app route to describe', () => {
    expect(toParentTask(record(), false, LIMIT).competencyCode).toBe('kmk-mathe@2022:z.1');
    expect(toParentTask(record({ competencyCode: null }), true, LIMIT).competencyCode).toBeNull();
  });
});

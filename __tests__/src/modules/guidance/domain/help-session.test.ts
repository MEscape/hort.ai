import { describe, expect, it } from 'vitest';

import {
  isSameTask,
  isSessionUnderstood,
  openQuestionCheck,
  progressOf,
  toLadderState,
} from '@modules/guidance/domain/models/help-session';
import type { AnswerCheckStep } from '@modules/guidance/domain/models/help-session';
import { toStepRequestId } from '@modules/guidance/domain/models/ids';
import type { AssignmentId } from '@modules/guidance/domain/models/ids';
import { UNCLASSIFIED_TOPIC } from '@modules/guidance/domain/topic/session-topic';

import { ASSIGNMENT, OTHER_CLASS_ASSIGNMENT, task } from '../fakes';
import { storedSession } from '../help-session-fakes';

function check(overrides: Partial<AnswerCheckStep> = {}): AnswerCheckStep {
  return {
    requestId: toStepRequestId('check-1'),
    answer: task('42'),
    result: 'correct',
    assessedBy: 'solution_key',
    hintLevel: null,
    feedbackText: null,
    question: { text: 'Wie hast du gerechnet?', reply: null },
    occurredAt: new Date('2026-10-25T08:00:00.000Z'),
    ...overrides,
  };
}

describe('help session progress', () => {
  it('is working before any answer and after an answer that is not yet right', () => {
    expect(progressOf(storedSession())).toBe('working');
    expect(
      progressOf(storedSession({ answerChecks: [check({ result: 'not_yet', question: null })] })),
    ).toBe('working');
  });

  it('waits for the comprehension reply after a correct answer', () => {
    const session = storedSession({ answerChecks: [check()] });

    expect(progressOf(session)).toBe('awaiting_comprehension_reply');
    expect(openQuestionCheck(session)?.requestId).toBe('check-1');
    expect(isSessionUnderstood(session)).toBe(false);
  });

  it('is understood only once the correct answer and the reply are both stored', () => {
    const session = storedSession({
      answerChecks: [check({ question: { text: null, reply: 'Erst die Zehner.' } })],
    });

    expect(progressOf(session)).toBe('understood');
    expect(openQuestionCheck(session)).toBeNull();
  });

  it('never counts a reply after a result that was not correct', () => {
    const session = storedSession({
      answerChecks: [check({ result: 'partly_correct', question: { text: null, reply: 'x' } })],
    });

    expect(isSessionUnderstood(session)).toBe(false);
  });

  it('continues only the same task in the same subject', () => {
    const session = storedSession();

    const own = (text: string, subject: 'math' | 'german' = 'math') => ({
      assignmentId: null,
      task: task(text),
      subject,
    });

    expect(isSameTask(session, own('Rechne 23 + 19.'))).toBe(true);
    expect(isSameTask(session, own('Rechne 23 + 19.', 'german'))).toBe(false);
    expect(isSameTask(session, own('Rechne 50 - 8.'))).toBe(false);
  });

  it('continues an assignment by its id, even when the teacher edited its text since (#33)', () => {
    const session = storedSession({ assignmentId: ASSIGNMENT });
    const source = (assignmentId: AssignmentId | null, text = 'Rechne 23 + 19.') => ({
      assignmentId,
      task: task(text),
      subject: 'math' as const,
    });

    expect(isSameTask(session, source(ASSIGNMENT, 'Rechne 23 + 19, mit Rechenweg.'))).toBe(true);
    expect(isSameTask(session, source(OTHER_CLASS_ASSIGNMENT))).toBe(false);
    expect(isSameTask(session, source(null))).toBe(false);
    expect(isSameTask(storedSession(), source(ASSIGNMENT))).toBe(false);
  });
});

describe('hint ladder state of a session', () => {
  it('carries the competency the session was classified with, never an open topic label (#35)', () => {
    const classified = storedSession({
      topic: { ...UNCLASSIFIED_TOPIC, intent: 'homework', competencyCode: 'M2.4' },
    });
    const open = storedSession({
      topic: { ...UNCLASSIFIED_TOPIC, intent: 'homework', openTopicLabel: 'brueche' },
    });

    expect(toLadderState(classified).competencyCode).toBe('M2.4');
    expect(toLadderState(open).competencyCode).toBeNull();
  });
});

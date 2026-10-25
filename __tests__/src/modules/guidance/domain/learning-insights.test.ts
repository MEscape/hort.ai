import { describe, expect, it } from 'vitest';

import {
  CLASS_MIN_GROUP,
  median,
  summarizeClass,
} from '@modules/guidance/domain/insights/class-overview';
import type { ClassSessionRecord } from '@modules/guidance/domain/insights/class-overview';
import {
  LABEL_MAX_LENGTH,
  SUMMARY_SESSION_LIMIT,
  highestHintLevel,
  summarizeLearning,
  summarySince,
  topicLabel,
} from '@modules/guidance/domain/insights/learning-summary';
import type { SessionLearningRecord } from '@modules/guidance/domain/insights/learning-summary';

const NAMES = {
  assignmentTitles: new Map([['assignment-1', 'Brüche üben']]),
  competencyTexts: new Map([['he-math@2022:M3.1', 'Addieren im Zahlenraum bis 1000']]),
};

function session(overrides: Partial<SessionLearningRecord> = {}): SessionLearningRecord {
  return {
    assignmentId: null,
    competencyCode: null,
    openTopicLabel: null,
    status: 'active',
    startedAt: new Date('2026-10-20T08:00:00.000Z'),
    hintLevels: [],
    comprehensionAnswered: false,
    ...overrides,
  };
}

describe('the parent learning summary (#35)', () => {
  it('names a topic by the assignment title, then the competency, then the open label, else none', () => {
    const all = {
      assignmentId: 'assignment-1',
      competencyCode: 'he-math@2022:M3.1',
      openTopicLabel: 'Dinosaurier',
    };
    expect(topicLabel(session(all), NAMES)).toBe('Brüche üben');
    expect(topicLabel(session({ ...all, assignmentId: 'deleted' }), NAMES)).toBe(
      'Addieren im Zahlenraum bis 1000',
    );
    expect(topicLabel(session({ openTopicLabel: 'Dinosaurier' }), NAMES)).toBe('Dinosaurier');
    expect(topicLabel(session({ competencyCode: 'material:x:1' }), NAMES)).toBeNull();
    expect(topicLabel(session(), NAMES)).toBeNull();
  });

  it('cuts a long label to one short line', () => {
    const label = topicLabel(session({ openTopicLabel: 'a'.repeat(200) }), NAMES);
    expect(label?.length).toBe(LABEL_MAX_LENGTH);
    expect(label?.endsWith('…')).toBe(true);
  });

  it('keeps the newest ten sessions, newest first', () => {
    const records = Array.from({ length: 12 }, (_, day) =>
      session({ startedAt: new Date(Date.UTC(2026, 9, day + 1)) }),
    );
    const { sessions } = summarizeLearning(records, NAMES);
    expect(sessions).toHaveLength(SUMMARY_SESSION_LIMIT);
    expect(sessions[0]?.startedAt.toISOString()).toBe('2026-10-12T00:00:00.000Z');
    expect(sessions.at(-1)?.startedAt.toISOString()).toBe('2026-10-03T00:00:00.000Z');
  });

  it('counts hints and finds the highest rung', () => {
    expect(highestHintLevel([])).toBeNull();
    expect(highestHintLevel(['next_step', 'understand_task', 'activate_prior_knowledge'])).toBe(
      'next_step',
    );
    const [line] = summarizeLearning(
      [session({ hintLevels: ['understand_task', 'activate_prior_knowledge'] })],
      NAMES,
    ).sessions;
    expect(line).toMatchObject({ hintCount: 2, highestHintLevel: 'activate_prior_knowledge' });
  });

  it('says "many hints" from three hints or a similar example on, once per topic', () => {
    const summary = summarizeLearning(
      [
        session({
          assignmentId: 'assignment-1',
          hintLevels: ['understand_task', 'activate_prior_knowledge', 'next_step'],
        }),
        session({
          assignmentId: 'assignment-1',
          hintLevels: ['understand_task', 'next_step', 'next_step'],
        }),
        session({ openTopicLabel: 'Uhr lesen', hintLevels: ['similar_example'] }),
        session({ openTopicLabel: 'Leicht', hintLevels: ['understand_task', 'next_step'] }),
        session({ hintLevels: ['similar_example'] }),
      ],
      NAMES,
    );
    expect(summary.neededManyHints).toEqual(['Brüche üben', 'Uhr lesen', null]);
  });

  it('says "understood" only for a completed task with the comprehension question answered', () => {
    const summary = summarizeLearning(
      [
        session({ openTopicLabel: 'Fertig', status: 'completed', comprehensionAnswered: true }),
        session({ openTopicLabel: 'Offen', status: 'active', comprehensionAnswered: true }),
        session({ openTopicLabel: 'Gewechselt', status: 'abandoned' }),
      ],
      NAMES,
    );
    expect(summary.understood).toEqual(['Fertig']);
  });

  it('looks back fourteen days', () => {
    expect(summarySince(new Date('2026-10-25T06:00:00.000Z')).toISOString()).toBe(
      '2026-10-11T06:00:00.000Z',
    );
  });
});

function classSession(overrides: Partial<ClassSessionRecord> = {}): ClassSessionRecord {
  return {
    assignmentId: 'assignment-1',
    childProfileId: 'child-1',
    status: 'active',
    hintCount: 0,
    ...overrides,
  };
}

describe('the teacher class overview (#35)', () => {
  const ASSIGNMENTS = [
    { id: 'assignment-1', title: 'Brüche üben' },
    { id: 'assignment-2', title: 'Uhr lesen' },
  ];

  it('shows no number below three children, the same for none, one or two', () => {
    expect(CLASS_MIN_GROUP).toBe(3);
    const two = summarizeClass(ASSIGNMENTS, [
      classSession({ childProfileId: 'a' }),
      classSession({ childProfileId: 'b', status: 'completed' }),
      classSession({ childProfileId: 'b', hintCount: 4 }),
    ]);
    expect(two).toEqual([
      { kind: 'too_few', assignmentId: 'assignment-1', title: 'Brüche üben' },
      { kind: 'too_few', assignmentId: 'assignment-2', title: 'Uhr lesen' },
    ]);
  });

  it("counts children, not sessions, and sums each child's hints for the median", () => {
    const [stats] = summarizeClass(ASSIGNMENTS, [
      classSession({ childProfileId: 'a', hintCount: 1, status: 'abandoned' }),
      classSession({ childProfileId: 'a', hintCount: 2, status: 'completed' }),
      classSession({ childProfileId: 'b', hintCount: 5 }),
      classSession({ childProfileId: 'c', hintCount: 0, status: 'completed' }),
      classSession({ childProfileId: 'd', assignmentId: 'other-class', hintCount: 9 }),
    ]);
    expect(stats).toEqual({
      kind: 'shown',
      assignmentId: 'assignment-1',
      title: 'Brüche üben',
      children: 3,
      completed: 2,
      medianHints: 3,
    });
  });

  it('carries no child id in its result', () => {
    const result = summarizeClass(ASSIGNMENTS, [
      classSession({ childProfileId: 'child-secret-a' }),
      classSession({ childProfileId: 'child-secret-b' }),
      classSession({ childProfileId: 'child-secret-c' }),
    ]);
    expect(JSON.stringify(result)).not.toContain('child-secret');
  });

  it('takes the middle of an even count as the mean of the two', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([7])).toBe(7);
    expect(median([])).toBe(0);
  });
});

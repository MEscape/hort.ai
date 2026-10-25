import { describe, expect, it, vi } from 'vitest';

import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import type { Actor } from '@modules/auth/domain/models/actor';
import { TEACHER_ROLE } from '@modules/auth/domain/models/role';
import type { InsightDependencies } from '@modules/guidance/application/insight-dependencies';
import { GetClassLearningOverview } from '@modules/guidance/application/queries/get-class-learning-overview';
import { GetLearningSummary } from '@modules/guidance/application/queries/get-learning-summary';
import type { ClassSessionRecord } from '@modules/guidance/domain/insights/class-overview';
import type { SessionLearningRecord } from '@modules/guidance/domain/insights/learning-summary';
import type { ChildProfileId } from '@modules/guidance/domain/models/ids';

import { notFoundError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

import { parent, recordingAudit, signedInAs } from '../../auth/fakes';
import { OTHER_CHILD, OWN_CHILD } from '../fakes';

const NOW = new Date('2026-10-25T06:00:00.000Z');

const RECORD: SessionLearningRecord = {
  assignmentId: 'assignment-1',
  competencyCode: 'he-math@2022:M3.1',
  openTopicLabel: null,
  status: 'completed',
  startedAt: new Date('2026-10-24T14:00:00.000Z'),
  hintLevels: ['understand_task', 'next_step', 'similar_example'],
  comprehensionAnswered: true,
};

function deps(
  options: {
    readonly actor?: Actor;
    readonly insightsOn?: boolean;
    readonly classSessions?: readonly ClassSessionRecord[];
  } = {},
) {
  const listChildSessions = vi.fn(() => okAsync([RECORD]));
  const listAssignmentSessions = vi.fn(() => okAsync(options.classSessions ?? []));
  const describeLabels = vi.fn(() => okAsync(new Map([['he-math@2022:M3.1', 'Addieren']])));
  const ofOwnClass = vi.fn((classroomId: string) =>
    okAsync(classroomId === 'own-class' ? [{ id: 'assignment-1', title: 'Brüche üben' }] : null),
  );
  const dependencies: InsightDependencies = {
    authorization: createAuthorizationService({
      currentActor: signedInAs(options.actor ?? parent()),
      audit: recordingAudit(),
    }),
    clock: { now: () => NOW },
    consent: {
      isEnabled: (id: ChildProfileId) =>
        id === OWN_CHILD
          ? okAsync(options.insightsOn ?? true)
          : errAsync(notFoundError('learner.child_profile_not_found', 'Not found.')),
    },
    assignments: {
      titlesForChild: () => okAsync(new Map([['assignment-1', 'Brüche üben']])),
      ofOwnClass,
    },
    competencies: { describe: describeLabels },
    records: { listChildSessions, listAssignmentSessions },
  };
  return { dependencies, listChildSessions, listAssignmentSessions, ofOwnClass };
}

describe('GetLearningSummary (#35)', () => {
  it('summarizes the own child by the teacher title, scoped to the parent and the last 14 days', async () => {
    const { dependencies, listChildSessions } = deps();
    const result = await new GetLearningSummary(dependencies).execute({
      childProfileId: OWN_CHILD,
    });
    expect(result._unsafeUnwrap()).toEqual({
      kind: 'on',
      summary: {
        sessions: [
          {
            startedAt: RECORD.startedAt,
            label: 'Brüche üben',
            status: 'completed',
            hintCount: 3,
            highestHintLevel: 'similar_example',
            comprehensionAnswered: true,
          },
        ],
        neededManyHints: ['Brüche üben'],
        understood: ['Brüche üben'],
      },
    });
    expect(listChildSessions).toHaveBeenCalledWith(
      { tenantId: parent().tenantId, ownerId: parent().id },
      OWN_CHILD,
      new Date('2026-10-11T06:00:00.000Z'),
      expect.objectContaining({ sessions: 10 }),
    );
  });

  it('reads nothing while learning notes are off', async () => {
    const { dependencies, listChildSessions } = deps({ insightsOn: false });
    const result = await new GetLearningSummary(dependencies).execute({
      childProfileId: OWN_CHILD,
    });
    expect(result._unsafeUnwrap()).toEqual({ kind: 'off' });
    expect(listChildSessions).not.toHaveBeenCalled();
  });

  it("reads nothing for another parent's child", async () => {
    const { dependencies, listChildSessions } = deps();
    const result = await new GetLearningSummary(dependencies).execute({
      childProfileId: OTHER_CHILD,
    });
    expect(result._unsafeUnwrapErr().kind).toBe('not_found');
    expect(listChildSessions).not.toHaveBeenCalled();
  });
});

describe('GetClassLearningOverview (#35)', () => {
  const teacher = parent({ roles: [TEACHER_ROLE] });
  const three: ClassSessionRecord[] = ['a', 'b', 'c'].map((childProfileId) => ({
    assignmentId: 'assignment-1',
    childProfileId: `child-secret-${childProfileId}`,
    status: 'completed',
    hintCount: 2,
  }));

  it('gives the own class numbers per assignment and no child id', async () => {
    const { dependencies } = deps({ actor: teacher, classSessions: three });
    const result = await new GetClassLearningOverview(dependencies).execute('own-class');
    const view = result._unsafeUnwrap();
    expect(view).toEqual({
      assignments: [
        {
          kind: 'shown',
          assignmentId: 'assignment-1',
          title: 'Brüche üben',
          children: 3,
          completed: 3,
          medianHints: 2,
        },
      ],
    });
    expect(JSON.stringify(view)).not.toContain('child-secret');
  });

  it("reads no session of another teacher's class", async () => {
    const { dependencies, listAssignmentSessions } = deps({ actor: teacher });
    const result = await new GetClassLearningOverview(dependencies).execute('foreign-class');
    expect(result._unsafeUnwrap()).toBeNull();
    expect(listAssignmentSessions).not.toHaveBeenCalled();
  });

  it('refuses a parent before anything is read', async () => {
    const { dependencies, ofOwnClass } = deps();
    const result = await new GetClassLearningOverview(dependencies).execute('own-class');
    expect(result._unsafeUnwrapErr().kind).toBe('forbidden');
    expect(ofOwnClass).not.toHaveBeenCalled();
  });
});

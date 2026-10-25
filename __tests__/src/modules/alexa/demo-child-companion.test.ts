import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toTutorId } from '@modules/alexa/domain/models/ids';
import { demoChildCompanion } from '@modules/alexa/infrastructure/child/demo-child-companion';

import { infrastructureError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

/** Which child each use case was asked for, and as whose channel. */
const asked: string[] = [];
const channels: string[] = [];
let profileTutor: string | null = 'lili';
let classroom: { id: string } | null = { id: 'class-1' };
let failProgress = false;

const progress = (overrides: Record<string, unknown> = {}) => ({
  level: 2,
  maxLevel: 6,
  xpIntoLevel: 5,
  xpForNextLevel: 30,
  dailyReward: { status: 'available', xp: 5 },
  mood: 'sleepy',
  ...overrides,
});

vi.mock('@modules/auth', () => ({
  runAsChildChannel: (guardianId: string, work: () => Promise<unknown>) => {
    channels.push(guardianId);
    return work();
  },
}));
vi.mock('@modules/learner', () => ({
  isLearningAllowedNow: (controls: { open: boolean }) => controls.open,
  getLearnerQueries: () => ({
    getChildProfileById: {
      execute: (id: string) => {
        asked.push(id);
        return okAsync({ tutorId: profileTutor, controls: { open: false } });
      },
    },
  }),
}));
vi.mock('@modules/progression', () => ({
  getProgressionQueries: () => ({
    getProgress: {
      execute: ({ childProfileId }: { childProfileId: string }) => {
        asked.push(childProfileId);
        return failProgress
          ? errAsync(infrastructureError('db.down', 'Down.'))
          : okAsync(progress());
      },
    },
  }),
  getProgressionCommands: () => ({
    claimDailyReward: {
      execute: ({ childProfileId }: { childProfileId: string }) => {
        asked.push(childProfileId);
        return okAsync({
          outcome: 'granted',
          leveledUp: true,
          progress: progress({ level: 3, dailyReward: { status: 'claimed', xp: 5 } }),
        });
      },
    },
  }),
}));
vi.mock('@modules/assignments', () => ({
  assignmentsQueries: {
    listChildAssignments: {
      execute: (id: string) => {
        asked.push(id);
        return okAsync([{ id: 'a1', title: 'Murmeln', taskText: 'x', dueDate: null }]);
      },
    },
  },
}));
vi.mock('@modules/classroom', () => ({
  classroomQueries: {
    getChildClassroom: {
      execute: (id: string) => {
        asked.push(id);
        return okAsync(classroom);
      },
    },
  },
}));

const companion = demoChildCompanion({
  guardianId: 'guardian-1',
  childProfileId: 'child-1',
  readyTutors: [toTutorId('max'), toTutorId('lili')],
  now: () => new Date('2026-10-25T10:00:00Z'),
});

beforeEach(() => {
  asked.length = 0;
  channels.length = 0;
  profileTutor = 'lili';
  classroom = { id: 'class-1' };
  failProgress = false;
});

describe('demoChildCompanion', () => {
  it('reads home for the configured child only, as the guardian channel', async () => {
    const home = await companion.home();

    expect(home._unsafeUnwrap()).toEqual({
      tutorId: 'lili',
      learningAllowed: false,
      rewardAvailable: true,
      mood: 'sleepy',
      openTasks: 1,
    });
    expect(new Set(asked)).toEqual(new Set(['child-1']));
    expect(channels).toEqual(['guardian-1']);
  });

  it('speaks as no companion when the profile names none or an unknown tutor', async () => {
    profileTutor = 'nemo';
    expect((await companion.companion())._unsafeUnwrap()).toBeNull();
    profileTutor = null;
    expect((await companion.companion())._unsafeUnwrap()).toBeNull();
    profileTutor = 'max';
    expect((await companion.companion())._unsafeUnwrap()).toBe('max');
  });

  it('feeds, tells the level and lists the task titles without keys', async () => {
    expect((await companion.feed())._unsafeUnwrap()).toEqual({
      outcome: 'granted',
      stars: 5,
      leveledUp: true,
      level: 3,
    });
    expect((await companion.level())._unsafeUnwrap()).toEqual({ level: 2, starsToNext: 25 });
    expect((await companion.tasks())._unsafeUnwrap()).toEqual({
      inClass: true,
      titles: ['Murmeln'],
    });
    classroom = null;
    expect((await companion.tasks())._unsafeUnwrap().inClass).toBe(false);
    expect(new Set(asked)).toEqual(new Set(['child-1']));
  });

  it('passes a use-case failure on as a failed result', async () => {
    failProgress = true;

    expect((await companion.level()).isErr()).toBe(true);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toTutorId } from '@modules/alexa/domain/models/ids';
import { demoChildCompanion } from '@modules/alexa/infrastructure/child/demo-child-companion';

import { infrastructureError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

/** Which child each use case was asked for, and as whose channel. */
const asked: string[] = [];
const channels: unknown[] = [];
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
  runAsChildChannel: (binding: unknown, work: () => Promise<unknown>) => {
    channels.push(binding);
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

/** What the help-session and voice use cases were called with. */
const guided: Array<[string, unknown]> = [];
const openSession = {
  sessionId: 's1',
  assignmentId: null,
  task: '36 geteilt durch 4',
  subject: 'math',
  status: 'working',
  hintLevel: 'understand_task',
  hints: [{ kind: 'fallback', level: 'understand_task', reason: 'ai_unavailable' }],
  answerChecks: [],
  openQuestion: null,
  opening: null,
  updatedAt: '2026-10-25T10:00:00Z',
};
let hintOutcome: unknown = { kind: 'fallback', level: 'next_step', reason: 'ai_unavailable' };

vi.mock('@modules/guidance', async () => ({
  deGuidance: (
    await vi.importActual<{ default: unknown }>('@modules/guidance/presentation/i18n/de.json')
  ).default,
  getHelpSessionQueries: () => ({
    getOpenHelpSession: { execute: () => okAsync(openSession) },
  }),
  getHelpSessionCommands: () => ({
    startHelpSession: {
      execute: (input: unknown) => (
        guided.push(['start', input]),
        okAsync({ outcome: 'started', session: openSession })
      ),
    },
    replyToComprehensionQuestion: {
      execute: () => okAsync({ sessionId: 's1', status: 'understood' }),
    },
  }),
  getGuidanceCommands: () => ({
    requestHint: {
      execute: (input: unknown) => (
        guided.push(['hint', input]),
        okAsync({ hint: hintOutcome, step: 1, isTopStep: false })
      ),
    },
    checkAnswer: {
      execute: () =>
        okAsync({
          result: 'correct',
          assessedBy: 'solution_key',
          next: 'comprehension_question',
          praise: { kind: 'generated', text: 'Klasse gemacht!' },
          question: { kind: 'predefined', feedback: 'comprehension_question', reason: null },
        }),
    },
  }),
}));
vi.mock('@modules/voice', () => ({
  getVoiceQueries: () => ({
    issueReadAloudTicket: {
      execute: (input: { message: unknown }) => (
        guided.push(['ticket', input.message]),
        okAsync({ ticket: 'ticket-1', speakerId: 'max' })
      ),
    },
  }),
  getHostedSpeech: () => ({
    execute: (input: unknown) => (
      guided.push(['hosted', input]),
      okAsync({ url: 'https://clips.example/c.mp3', expiresAt: new Date() })
    ),
  }),
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
  guided.length = 0;
  hintOutcome = { kind: 'fallback', level: 'next_step', reason: 'ai_unavailable' };
});

describe('demoChildCompanion', () => {
  it('reads home for the configured child only, as the Alexa channel bound to that child', async () => {
    const home = await companion.home();

    expect(home._unsafeUnwrap()).toEqual({
      tutorId: 'lili',
      learningAllowed: false,
      rewardAvailable: true,
      mood: 'sleepy',
      openTasks: 1,
    });
    expect(new Set(asked)).toEqual(new Set(['child-1']));
    expect(new Set(channels.map((binding) => JSON.stringify(binding)))).toEqual(
      new Set([
        JSON.stringify({ channel: 'alexa', guardianId: 'guardian-1', childProfileId: 'child-1' }),
      ]),
    );
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

  it('starts the own task as a maths session and says the first hint in the catalog wording', async () => {
    const said = await companion.startHelp({ kind: 'own', text: '36 geteilt durch 4' }, 'req-1');

    expect(said._unsafeUnwrap()).toEqual({
      text: 'Was könntest du als Erstes tun? Überleg dir nur den nächsten kleinen Schritt.',
      message: 'latest_hint',
    });
    expect(guided).toEqual([
      ['start', { childProfileId: 'child-1', task: '36 geteilt durch 4', subject: 'math' }],
      ['hint', { childProfileId: 'child-1', sessionId: 's1', requestId: 'req-1' }],
    ]);
  });

  it('starts a teacher assignment named by its title or position, never with the text as task', async () => {
    await companion.startHelp({ kind: 'own', text: 'die aufgabe murmeln' }, 'req-2');
    await companion.startHelp({ kind: 'assignment', position: 1 }, 'req-3');
    const missing = await companion.startHelp({ kind: 'assignment', position: 4 }, 'req-4');

    const starts = guided.filter(([step]) => step === 'start').map(([, input]) => input);
    expect(starts).toEqual([
      { childProfileId: 'child-1', assignmentId: 'a1', subject: 'general_studies' },
      { childProfileId: 'child-1', assignmentId: 'a1', subject: 'general_studies' },
    ]);
    expect(missing._unsafeUnwrapErr().kind).toBe('not_found');
  });

  it('passes a validated hint on as it is, and maps a correct answer onto praise and question', async () => {
    hintOutcome = { kind: 'generated', level: 'next_step', text: 'Wie viele Vierer passen in 36?' };

    expect((await companion.nextHint('s1', 'req-5'))._unsafeUnwrap().text).toBe(
      'Wie viele Vierer passen in 36?',
    );
    expect((await companion.checkAnswer('s1', 'req-6', 'neun'))._unsafeUnwrap()).toEqual({
      correct: true,
      says: [
        { text: 'Klasse gemacht!', message: 'latest_feedback' },
        {
          text: 'Erklär mir in deinen eigenen Worten, wie du auf deine Antwort gekommen bist.',
          message: 'question',
        },
      ],
    });
    expect((await companion.replyToQuestion('s1', 'weil'))._unsafeUnwrap()).toEqual({
      understood: true,
    });
    expect((await companion.openHelp())._unsafeUnwrap()).toEqual({
      sessionId: 's1',
      status: 'working',
      task: '36 geteilt durch 4',
    });
  });

  it('voices the latest hint through a read-aloud ticket, hosted in the companion voice', async () => {
    const url = await companion.tutorVoice('latest_hint');

    expect(url._unsafeUnwrap()).toBe('https://clips.example/c.mp3');
    expect(guided).toEqual([
      ['ticket', { sessionId: 's1', kind: 'hint', index: 0 }],
      [
        'hosted',
        {
          speakerId: 'max',
          source: { kind: 'ticket', ticket: 'ticket-1', childProfileId: 'child-1' },
        },
      ],
    ]);
    expect((await companion.tutorVoice('latest_feedback')).isErr()).toBe(true);
  });
});

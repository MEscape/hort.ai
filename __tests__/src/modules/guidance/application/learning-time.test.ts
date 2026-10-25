import { describe, expect, it } from 'vitest';

import { ReplyToComprehensionQuestion } from '@modules/guidance/application/commands/reply-to-comprehension-question';
import { RequestHint } from '@modules/guidance/application/commands/request-hint';
import { StartHelpSession } from '@modules/guidance/application/commands/start-help-session';
import { GetOpenHelpSession } from '@modules/guidance/application/queries/get-open-help-session';
import { HintOrchestrator } from '@modules/guidance/application/services/hint-orchestrator';
import { countLearningMinutes } from '@modules/guidance/domain/models/learning-time';
import type { HintProvider } from '@modules/guidance/domain/ports/hint-provider.port';
import { berlinDay, computeScreenTime } from '@modules/learner';

import { okAsync } from '@lib/result';

import { OWN_CHILD, SESSION } from '../fakes';
import { helpSessionDependencies, inMemorySessions, storedSession } from '../help-session-fakes';

const input = { childProfileId: OWN_CHILD, subject: 'math', task: 'Rechne 23 + 19.' };
const OTHER_TASK = { ...input, task: 'Eine ganz andere Aufgabe.' };
const step = { childProfileId: OWN_CHILD, sessionId: SESSION, requestId: 'request-1' };

const minutes = (hhmm: string) => {
  const [hours = 0, mins = 0] = hhmm.split(':').map(Number);
  return hours * 60 + mins;
};
const window = (from: string, until: string) => ({
  fromMinute: minutes(from),
  untilMinute: minutes(until),
});

const hints: HintProvider = {
  suggest: (request) =>
    okAsync({ version: 1, kind: 'hint', hintLevel: request.level, text: 'Was weißt du schon?' }),
};

interface Setup {
  readonly now: string;
  readonly allowedWindow?: { fromMinute: number; untilMinute: number } | null;
  readonly dailyLimitMinutes?: number | null;
  /** Instants the backend stored for today's activity; the limit is read from them. */
  readonly activity?: readonly string[];
}

/** The session use cases over the real learner rule, on a fixed clock and the given controls. */
function build({ now, allowedWindow = null, dailyLimitMinutes = null, activity = [] }: Setup) {
  const store = inMemorySessions([storedSession()]);
  const reads: string[] = [];
  const repository = {
    ...store.repository,
    learningActivity: () => {
      reads.push('learningActivity');
      return okAsync(activity.map((instant) => new Date(instant)));
    },
  };
  const { deps: base } = helpSessionDependencies(repository);
  const deps = {
    ...base,
    clock: { now: () => new Date(now) },
    childProfiles: {
      findOwn: () =>
        okAsync({
          id: OWN_CHILD,
          grade: 3,
          federalState: 'HE',
          controls: { dailyLimitMinutes, allowedWindow },
        }),
    },
  };
  return {
    store,
    reads,
    start: new StartHelpSession(deps),
    open: new GetOpenHelpSession(deps),
    hint: new RequestHint({
      ...deps,
      hints: new HintOrchestrator({ provider: hints, audit: deps.audit }),
    }),
    reply: new ReplyToComprehensionQuestion(deps),
  };
}

const everyMinute = (from: string, count: number) =>
  Array.from({ length: count }, (_, index) =>
    new Date(new Date(from).getTime() + index * 60_000).toISOString(),
  );

describe('learning window (#88)', () => {
  // Window 14:00-18:00 Berlin. On 2026-10-25 Berlin is on CET (UTC+1) again, so 14:00 is 13:00Z.
  const inWindow = { allowedWindow: window('14:00', '18:00') };

  it('refuses start, continue, hint and reply outside the window, with the time it opens again', async () => {
    const app = build({ ...inWindow, now: '2026-10-25T18:00:00Z' }); // 19:00 Berlin
    const closed = {
      code: 'guidance.learning_window_closed',
      kind: 'rate_limited',
      retryAfterSeconds: 19 * 3600, // tomorrow 14:00 Berlin
    };

    expect((await app.start.execute(input))._unsafeUnwrapErr()).toMatchObject(closed);
    expect((await app.start.execute(OTHER_TASK))._unsafeUnwrapErr()).toMatchObject(closed);
    expect((await app.hint.execute(step))._unsafeUnwrapErr()).toMatchObject(closed);
    expect(
      (await app.reply.execute({ ...step, reply: 'Ich habe addiert.' }))._unsafeUnwrapErr(),
    ).toMatchObject(closed);
    expect(app.store.starts).toEqual([]);
  });

  it('still shows the open session outside the window, so the screen can say why it rests', async () => {
    const app = build({ ...inWindow, now: '2026-10-25T18:00:00Z' });
    expect((await app.open.execute({ childProfileId: OWN_CHILD })).isOk()).toBe(true);
  });

  it('works inside the window', async () => {
    const app = build({ ...inWindow, now: '2026-10-25T15:00:00Z' });
    expect((await app.start.execute(input))._unsafeUnwrap().outcome).toBe('continued');
    expect((await app.hint.execute(step)).isOk()).toBe(true);
  });

  it.each([
    ['opens inclusive at 14:00', '2026-10-25T13:00:00Z', true],
    ['is open at 17:59', '2026-10-25T16:59:00Z', true],
    ['closes exclusive at 18:00', '2026-10-25T17:00:00Z', false],
    ['is closed one minute before 14:00', '2026-10-25T12:59:00Z', false],
  ])('the window %s', async (_name, now, allowed) => {
    const app = build({ ...inWindow, now });
    expect((await app.hint.execute(step)).isOk()).toBe(allowed);
  });

  it('opens at the real moment after the swallowed hour of the spring clock change', async () => {
    // 2026-03-29: Berlin jumps 02:00 -> 03:00. A 03:00-04:00 window opens at 01:00Z (03:00 CEST).
    const early = build({ allowedWindow: window('03:00', '04:00'), now: '2026-03-29T00:59:00Z' });
    expect((await early.hint.execute(step))._unsafeUnwrapErr()).toMatchObject({
      code: 'guidance.learning_window_closed',
      retryAfterSeconds: 60,
    });
    const open = build({ allowedWindow: window('03:00', '04:00'), now: '2026-03-29T01:00:00Z' });
    expect((await open.hint.execute(step)).isOk()).toBe(true);
  });

  it('keeps a 02:00-03:00 window open through both passes of the repeated autumn hour', async () => {
    // 2026-10-25: Berlin 02:00-03:00 happens twice (00:00Z-01:00Z in CEST, 01:00Z-02:00Z in CET).
    for (const [now, allowed] of [
      ['2026-10-25T00:30:00Z', true],
      ['2026-10-25T01:30:00Z', true],
      ['2026-10-25T02:00:00Z', false],
    ] as const) {
      const app = build({ allowedWindow: window('02:00', '03:00'), now });
      expect((await app.hint.execute(step)).isOk()).toBe(allowed);
    }
  });

  it('never blocks the defaults (any time, no limit) and never reads the activity for them', async () => {
    const app = build({
      now: '2026-10-25T02:00:00Z',
      activity: everyMinute('2026-10-25T00:00:00Z', 300),
    });
    expect((await app.hint.execute(step)).isOk()).toBe(true);
    expect((await app.start.execute(OTHER_TASK))._unsafeUnwrap().outcome).toBe('started');
    expect(app.reads).toEqual([]);
  });
});

describe('daily limit (#88)', () => {
  const used15 = everyMinute('2026-10-25T10:00:00Z', 16); // 15 minutes of steps, counted by the backend

  it('stops a new task once the day’s time is used, until the window opens tomorrow', async () => {
    const app = build({
      dailyLimitMinutes: 15,
      allowedWindow: window('14:00', '18:00'),
      now: '2026-10-25T13:30:00Z', // 14:30 Berlin
      activity: used15,
    });
    expect((await app.start.execute(OTHER_TASK))._unsafeUnwrapErr()).toMatchObject({
      code: 'guidance.daily_limit_reached',
      kind: 'rate_limited',
      retryAfterSeconds: 23.5 * 3600, // tomorrow 14:00 Berlin
    });
    expect(app.store.starts).toEqual([]);
  });

  it('names the start of tomorrow when there is no window', async () => {
    const app = build({ dailyLimitMinutes: 15, now: '2026-10-25T13:30:00Z', activity: used15 });
    expect((await app.start.execute(OTHER_TASK))._unsafeUnwrapErr()).toMatchObject({
      code: 'guidance.daily_limit_reached',
      retryAfterSeconds: 9.5 * 3600, // tomorrow 00:00 Berlin = 23:00Z
    });
  });

  it('lets the child finish the task in progress: resume, hint and screen still work', async () => {
    const app = build({ dailyLimitMinutes: 15, now: '2026-10-25T13:30:00Z', activity: used15 });
    expect((await app.start.execute(input))._unsafeUnwrap().outcome).toBe('continued');
    expect((await app.hint.execute(step)).isOk()).toBe(true);
    expect((await app.open.execute({ childProfileId: OWN_CHILD })).isOk()).toBe(true);
  });

  it('starts a new task while the day’s time is not yet used', async () => {
    const app = build({
      dailyLimitMinutes: 15,
      now: '2026-10-25T13:30:00Z',
      activity: everyMinute('2026-10-25T10:00:00Z', 15), // 14 minutes
    });
    expect((await app.start.execute(OTHER_TASK))._unsafeUnwrap().outcome).toBe('started');
  });

  it('counts anew on the next Berlin calendar day', async () => {
    const app = build({
      dailyLimitMinutes: 15,
      now: '2026-10-26T08:00:00Z',
      activity: used15, // yesterday's time
    });
    expect((await app.start.execute(OTHER_TASK))._unsafeUnwrap().outcome).toBe('started');
  });

  it('does not read the activity when there is no daily limit', async () => {
    const app = build({ dailyLimitMinutes: null, now: '2026-10-25T13:30:00Z' });
    await app.start.execute(OTHER_TASK);
    expect(app.reads).toEqual([]);
  });
});

describe('counting help time (#88)', () => {
  const count = (times: readonly string[], now: string) =>
    countLearningMinutes(
      times.map((time) => new Date(time)),
      new Date(now),
      berlinDay,
    );

  it('adds the time between steps, and nothing for the last one', () => {
    expect(count(['2026-10-25T10:00:00Z', '2026-10-25T10:03:00Z'], '2026-10-25T11:00:00Z')).toBe(3);
    expect(count(['2026-10-25T10:00:00Z'], '2026-10-25T11:00:00Z')).toBe(0);
    expect(count([], '2026-10-25T11:00:00Z')).toBe(0);
  });

  it('caps a pause between steps at five minutes: leaving the tablet is not learning', () => {
    expect(count(['2026-10-25T10:00:00Z', '2026-10-25T12:00:00Z'], '2026-10-25T13:00:00Z')).toBe(5);
  });

  it('counts steps at the same instant once and ignores order and the future', () => {
    expect(
      count(
        [
          '2026-10-25T10:04:00Z',
          '2026-10-25T10:00:00Z',
          '2026-10-25T10:00:00Z',
          '2026-10-25T10:08:00Z',
        ],
        '2026-10-25T10:06:00Z',
      ),
    ).toBe(4);
  });

  it('counts only the Berlin calendar day of now', () => {
    // Berlin midnight is 22:00Z on the 24th (CEST). A step before it belongs to yesterday.
    expect(count(['2026-10-24T21:58:00Z', '2026-10-24T22:03:00Z'], '2026-10-25T00:00:00Z')).toBe(0);
    expect(count(['2026-10-24T22:01:00Z', '2026-10-24T22:04:00Z'], '2026-10-25T00:00:00Z')).toBe(3);
  });

  it('counts the 25-hour day of the autumn clock change on the real timeline', () => {
    // Steps every 5 minutes across 03:00 CEST -> 02:00 CET: each pair adds its real five minutes.
    const times = [
      '2026-10-25T00:50:00Z', // 02:50 CEST
      '2026-10-25T00:55:00Z',
      '2026-10-25T01:00:00Z', // 02:00 CET
      '2026-10-25T01:05:00Z',
    ];
    expect(count(times, '2026-10-25T05:00:00Z')).toBe(15);
  });
});

describe('learner rule behind the window (#88)', () => {
  it.each([
    ['2026-10-24T21:00:00Z', '2026-10-25T13:00:00.000Z'],
    ['2026-03-28T21:00:00Z', '2026-03-29T12:00:00.000Z'],
  ])('finds the next Berlin opening through the clock change from %s', (now, next) => {
    const result = computeScreenTime({
      controls: { dailyLimitMinutes: null, allowedWindow: { fromMinute: 840, untilMinute: 1080 } },
      usedMinutes: null,
      now: new Date(now),
    });
    expect(result.reopensAt?.toISOString()).toBe(next);
  });

  it('never blocks the defaults', () => {
    expect(
      computeScreenTime({
        controls: { dailyLimitMinutes: null, allowedWindow: null },
        usedMinutes: null,
        now: new Date('2026-10-25T23:59:00Z'),
      }).status,
    ).toBe('open');
  });
});

import { describe, expect, it } from 'vitest';

import { toActorId, toTenantId } from '@modules/auth';
import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import { RequestHint } from '@modules/guidance/application/commands/request-hint';
import { StartHelpSession } from '@modules/guidance/application/commands/start-help-session';
import { GetTodayHelpMinutes } from '@modules/guidance/application/queries/get-today-help-minutes';
import { HintOrchestrator } from '@modules/guidance/application/services/hint-orchestrator';
import type { LearningControls } from '@modules/guidance/domain/ports/child-profile-access.port';
import type { HelpSessionRepository } from '@modules/guidance/domain/ports/help-session.repository';
import type { TopicClassifier } from '@modules/guidance/domain/ports/topic-classifier.port';

import { okAsync } from '@lib/result';

import { createTestRateLimiter } from '../../../support/rate-limiting';
import { parent, recordingAudit as recordingSecurityAudit, signedInAs } from '../../auth/fakes';
import {
  NOW,
  OTHER_CHILD,
  OWN_CHILD,
  SESSION,
  fakeAssignments,
  fakeCompetencies,
  fakeHintProvider,
  fakeSessionStore,
  openSession,
  ownChildren,
  recordingAuditLog,
} from '../fakes';
import { helpSessionDependencies, inMemorySessions } from '../help-session-fakes';

const NO_CONTROLS: LearningControls = { dailyLimitMinutes: null, allowedWindow: null };
/** 15:00 to 18:00; `NOW` is 10:00 in Berlin. */
const AFTERNOON = { fromMinute: 15 * 60, untilMinute: 18 * 60 };

/** A classifier that must never be reached in these tests' refusals; it keeps every task it saw. */
function watchingClassifier() {
  const tasks: string[] = [];
  const classifier: TopicClassifier = {
    name: 'jev',
    classify: (request) => {
      tasks.push(request.task);
      return okAsync({
        version: 1,
        intent: { value: 'homework', confidence: 0.9 },
        subject: null,
        topic: { kind: 'none' },
      });
    },
  };
  return { classifier, tasks };
}

function startWith({
  controls = NO_CONTROLS,
  helpMinutes = 0,
}: { readonly controls?: LearningControls; readonly helpMinutes?: number } = {}) {
  const store = inMemorySessions();
  store.usage.helpMinutes = helpMinutes;
  const { classifier, tasks } = watchingClassifier();
  const { deps, events } = helpSessionDependencies(
    store.repository,
    parent(),
    createTestRateLimiter(),
    fakeAssignments(),
    classifier,
    ownChildren([OWN_CHILD], { controls }),
  );
  return {
    store,
    events,
    classified: tasks,
    run: (task: string, childProfileId: string = OWN_CHILD) =>
      new StartHelpSession(deps).execute({ childProfileId, task, subject: 'math' }),
  };
}

describe('StartHelpSession distress check (#90)', () => {
  const WORDS = 'Mein Papa schlägt mich';

  it('gives the trusted-adult notice instead of help: no classifier, nothing stored, ids only in the log', async () => {
    const { run, store, events, classified } = startWith();

    const result = await run(WORDS);

    expect(result.isErr() && result.error.code).toBe('guidance.child_distress');
    expect(classified).toEqual([]);
    expect(store.starts).toEqual([]);
    expect(events).toEqual([
      {
        type: 'guidance.child_distress_detected',
        tenantId: toTenantId('default'),
        actorId: toActorId('parent-1'),
        childProfileId: OWN_CHILD,
        sessionId: null,
        step: 'start',
      },
    ]);
    expect(JSON.stringify(events)).not.toContain('Papa');
  });

  it("checks ownership first: another parent's child is not found and nothing is logged", async () => {
    const { run, events } = startWith();

    const result = await run(WORDS, OTHER_CHILD);

    expect(result.isErr() && result.error.kind).toBe('not_found');
    expect(events).toEqual([]);
  });

  it('wins over a closed day, so the child still gets the notice', async () => {
    const { run } = startWith({ controls: { ...NO_CONTROLS, allowedWindow: AFTERNOON } });

    const result = await run(WORDS);

    expect(result.isErr() && result.error.code).toBe('guidance.child_distress');
  });
});

describe('StartHelpSession screen time (server side)', () => {
  it('pauses a start outside the allowed hours, before anything is classified or stored', async () => {
    const { run, store, classified } = startWith({
      controls: { ...NO_CONTROLS, allowedWindow: AFTERNOON },
    });

    const result = await run('Rechne 23 + 19.');

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'forbidden',
      code: 'guidance.learning_paused',
    });
    expect(classified).toEqual([]);
    expect(store.starts).toEqual([]);
  });

  it("pauses a start once today's help minutes reach the daily limit", async () => {
    const { run, store, classified } = startWith({
      controls: { ...NO_CONTROLS, dailyLimitMinutes: 30 },
      helpMinutes: 30,
    });

    const result = await run('Rechne 23 + 19.');

    expect(result.isErr() && result.error.code).toBe('guidance.learning_paused');
    expect(classified).toEqual([]);
    expect(store.starts).toEqual([]);
  });

  it('starts while minutes are left inside the allowed hours', async () => {
    const { run, store } = startWith({
      controls: {
        dailyLimitMinutes: 30,
        allowedWindow: { fromMinute: 8 * 60, untilMinute: 18 * 60 },
      },
      helpMinutes: 29,
    });

    const result = await run('Rechne 23 + 19.');

    expect(result.isOk() && result.value.outcome).toBe('started');
    expect(store.starts).toHaveLength(1);
  });
});

describe('RequestHint gating', () => {
  function hintWith({
    controls = NO_CONTROLS,
    helpMinutesToday = 0,
    session = openSession(),
  }: {
    readonly controls?: LearningControls;
    readonly helpMinutesToday?: number;
    readonly session?: ReturnType<typeof openSession>;
  } = {}) {
    const { provider, requests } = fakeHintProvider({
      answer: { version: 1, kind: 'hint', hintLevel: 'understand_task', text: 'Was weißt du?' },
    });
    const { audit } = recordingAuditLog();
    const sessions = fakeSessionStore([session], { helpMinutesToday });
    const requestHint = new RequestHint({
      authorization: createAuthorizationService({
        currentActor: signedInAs(parent()),
        audit: recordingSecurityAudit(),
      }),
      childProfiles: ownChildren([OWN_CHILD], { controls }),
      assignments: fakeAssignments().access,
      competencies: fakeCompetencies().retrieval,
      rateLimiter: createTestRateLimiter(),
      sessions: sessions.store,
      hints: new HintOrchestrator({ provider, audit }),
      audit,
    });
    return {
      requests,
      sessions,
      run: () =>
        requestHint.execute({ childProfileId: OWN_CHILD, sessionId: SESSION, requestId: 'r-1' }),
    };
  }

  it('pauses a hint inside an open session once the daily limit is used up: no AI, nothing stored', async () => {
    const { run, requests, sessions } = hintWith({
      controls: { ...NO_CONTROLS, dailyLimitMinutes: 20 },
      helpMinutesToday: 25,
    });

    const result = await run();

    expect(result.isErr() && result.error.code).toBe('guidance.learning_paused');
    expect(requests).toEqual([]);
    expect(sessions.hintsOf()).toEqual([]);
  });

  it('pauses a hint outside the allowed hours', async () => {
    const { run, requests } = hintWith({ controls: { ...NO_CONTROLS, allowedWindow: AFTERNOON } });

    const result = await run();

    expect(result.isErr() && result.error.code).toBe('guidance.learning_paused');
    expect(requests).toEqual([]);
  });

  it('gives no hint in a session that opened with the friendly redirect (#92)', async () => {
    const { run, requests, sessions } = hintWith({
      session: openSession({ opening: { kind: 'redirect', intent: 'small_talk' } }),
    });

    const result = await run();

    expect(result.isErr() && result.error.code).toBe('guidance.no_hint_for_opening');
    expect(requests).toEqual([]);
    expect(sessions.hintsOf()).toEqual([]);
  });

  it('still helps a session that opened with a clarifying question', async () => {
    const { run } = hintWith({ session: openSession({ opening: { kind: 'clarify' } }) });

    const result = await run();

    expect(result.isOk()).toBe(true);
  });
});

describe('GetTodayHelpMinutes', () => {
  function queryWith(minutes: number) {
    const store = inMemorySessions();
    const ranges: Array<{ readonly from: Date; readonly to: Date }> = [];
    const repository: HelpSessionRepository = {
      ...store.repository,
      helpMinutesBetween: (_owner, _child, range) => {
        ranges.push(range);
        return okAsync(minutes);
      },
    };
    const { deps } = helpSessionDependencies(repository);
    return { ranges, query: new GetTodayHelpMinutes(deps) };
  }

  it("answers the own child's help minutes since midnight in Berlin", async () => {
    const { query, ranges } = queryWith(12);

    const result = await query.execute({ childProfileId: OWN_CHILD });

    expect(result.isOk() && result.value).toBe(12);
    // 25 October 2026 starts in summer time (UTC+2), so its midnight is 22:00 UTC the day before.
    expect(ranges).toEqual([{ from: new Date('2026-10-24T22:00:00.000Z'), to: NOW }]);
  });

  it("refuses another parent's child before measuring anything", async () => {
    const { query, ranges } = queryWith(12);

    const result = await query.execute({ childProfileId: OTHER_CHILD });

    expect(result.isErr() && result.error.kind).toBe('not_found');
    expect(ranges).toEqual([]);
  });
});

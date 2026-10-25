import { describe, expect, it } from 'vitest';

import { toActorId, toTenantId } from '@modules/auth';
import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import { RequestHint } from '@modules/guidance/application/commands/request-hint';
import { StartHelpSession } from '@modules/guidance/application/commands/start-help-session';
import { GetTodayHelpMinutes } from '@modules/guidance/application/queries/get-today-help-minutes';
import { HintOrchestrator } from '@modules/guidance/application/services/hint-orchestrator';
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
  learningTime,
  openSession,
  ownChildren,
  recordingAuditLog,
} from '../fakes';
import { helpSessionDependencies, inMemorySessions } from '../help-session-fakes';

/** 15:00 to 18:00; `NOW` is 10:00 in Berlin. */
const AFTERNOON = { fromMinute: 15 * 60, untilMinute: 18 * 60 };
const MS_PER_MINUTE = 60_000;

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
  allowedWindow = null,
}: { readonly allowedWindow?: typeof AFTERNOON | null } = {}) {
  const store = inMemorySessions();
  const { classifier, tasks } = watchingClassifier();
  const { deps, events } = helpSessionDependencies(
    store.repository,
    parent(),
    createTestRateLimiter(),
    fakeAssignments(),
    classifier,
    ownChildren([OWN_CHILD], { controls: { dailyLimitMinutes: null, allowedWindow } }),
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

  it('wins over a closed learning window (#88), so the child still gets the notice', async () => {
    const { run } = startWith({ allowedWindow: AFTERNOON });

    const result = await run(WORDS);

    expect(result.isErr() && result.error.code).toBe('guidance.child_distress');
  });
});

describe('RequestHint and the session opening (#92)', () => {
  function hintWith(session = openSession()) {
    const { provider, requests } = fakeHintProvider({
      answer: { version: 1, kind: 'hint', hintLevel: 'understand_task', text: 'Was weißt du?' },
    });
    const { audit } = recordingAuditLog();
    const sessions = fakeSessionStore([session]);
    const requestHint = new RequestHint({
      authorization: createAuthorizationService({
        currentActor: signedInAs(parent()),
        audit: recordingSecurityAudit(),
      }),
      childProfiles: ownChildren([OWN_CHILD]),
      assignments: fakeAssignments().access,
      competencies: fakeCompetencies().retrieval,
      rateLimiter: createTestRateLimiter(),
      sessions: sessions.store,
      hints: new HintOrchestrator({ provider, audit }),
      audit,
      ...learningTime(),
    });
    return {
      requests,
      sessions,
      run: () =>
        requestHint.execute({ childProfileId: OWN_CHILD, sessionId: SESSION, requestId: 'r-1' }),
    };
  }

  it('gives no hint in a session that opened with the friendly redirect', async () => {
    const { run, requests, sessions } = hintWith(
      openSession({ opening: { kind: 'redirect', intent: 'small_talk' } }),
    );

    const result = await run();

    expect(result.isErr() && result.error.code).toBe('guidance.no_hint_for_opening');
    expect(requests).toEqual([]);
    expect(sessions.hintsOf()).toEqual([]);
  });

  it('still helps a session that opened with a clarifying question', async () => {
    const { run } = hintWith(openSession({ opening: { kind: 'clarify' } }));

    const result = await run();

    expect(result.isOk()).toBe(true);
  });
});

describe('GetTodayHelpMinutes', () => {
  /** Stored step instants, minutes before `NOW`. */
  function queryWith(minutesAgo: readonly number[]) {
    const store = inMemorySessions();
    const reads: Date[] = [];
    const repository: HelpSessionRepository = {
      ...store.repository,
      learningActivity: (_owner, _child, since) => {
        reads.push(since);
        return okAsync(minutesAgo.map((ago) => new Date(NOW.getTime() - ago * MS_PER_MINUTE)));
      },
    };
    const { deps } = helpSessionDependencies(repository);
    return { reads, query: new GetTodayHelpMinutes(deps) };
  }

  it("counts the own child's help minutes like the daily limit does: steps, idle gaps capped", async () => {
    // 4 + 3 minutes between steps, then 30 idle minutes that count as the 5 minute cap.
    const { query } = queryWith([42, 12, 8, 5]);

    const result = await query.execute({ childProfileId: OWN_CHILD });

    expect(result.isOk() && result.value).toBe(12);
  });

  it("refuses another parent's child before reading anything", async () => {
    const { query, reads } = queryWith([10, 5]);

    const result = await query.execute({ childProfileId: OTHER_CHILD });

    expect(result.isErr() && result.error.kind).toBe('not_found');
    expect(reads).toEqual([]);
  });
});

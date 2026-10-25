import { describe, expect, it } from 'vitest';

import { toActorId } from '@modules/auth';
import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import type { CurrentActorProvider } from '@modules/auth/domain/ports/current-actor-provider.port';
import { RequestHint } from '@modules/guidance/application/commands/request-hint';
import { GUIDANCE_RATE_LIMITS } from '@modules/guidance/application/rate-limits';
import { HintOrchestrator } from '@modules/guidance/application/services/hint-orchestrator';
import type {
  CurriculumCompetency,
  HintRequest,
} from '@modules/guidance/domain/models/hint-request';
import { parseStepRequestId } from '@modules/guidance/domain/models/ids';
import type { HintProvider } from '@modules/guidance/domain/ports/hint-provider.port';

import type { RateLimiter } from '@lib/rate-limit';
import { errAsync, okAsync } from '@lib/result';

import { createBrokenRateLimiter, createTestRateLimiter } from '../../../support/rate-limiting';
import { parent, recordingAudit as recordingSecurityAudit, signedInAs } from '../../auth/fakes';
import {
  ASSIGNMENT,
  ASSIGNMENT_TEXT,
  CANDIDATES,
  OTHER_CHILD,
  OWN_CHILD,
  REQUEST,
  SESSION,
  fakeAssignments,
  fakeCompetencies,
  fakeSessionStore,
  openSession,
  ownChildren,
  recordingAuditLog,
  task,
} from '../fakes';

const TASK = 'Lisa hat 3 Äpfel und bekommt 4 dazu. Wie viele Äpfel hat sie?';
const textFor = (level: string) => `Denk an ${level}: Was passiert mit der Zahl der Äpfel?`;

/** An AI that words a valid hint for whatever level it is asked, or fails as told; it keeps every request. */
function ladderProvider(options: { readonly fails?: boolean; readonly text?: string } = {}) {
  const requests: HintRequest[] = [];
  const provider: HintProvider = {
    suggest(request) {
      requests.push(request);
      return options.fails
        ? errAsync({ kind: 'timeout' })
        : okAsync({
            version: 1,
            kind: 'hint',
            hintLevel: request.level,
            text: options.text ?? textFor(request.level),
          });
    },
  };
  return { provider, requests };
}

interface BuildOptions {
  readonly currentActor?: CurrentActorProvider;
  readonly rateLimiter?: RateLimiter;
  readonly aiFails?: true;
  readonly curriculumFails?: true;
  readonly curriculum?: readonly CurriculumCompetency[];
  readonly sessions?: ReturnType<typeof fakeSessionStore>;
  readonly owned?: Parameters<typeof ownChildren>[0];
  readonly assignments?: ReturnType<typeof fakeAssignments>;
  readonly hintText?: string;
}

function build(options: BuildOptions = {}) {
  const { provider, requests } = ladderProvider({
    fails: options.aiFails === true,
    ...(options.hintText === undefined ? {} : { text: options.hintText }),
  });
  const { audit, events } = recordingAuditLog();
  const { retrieval, queries } = fakeCompetencies({
    fails: options.curriculumFails === true,
    ...(options.curriculum === undefined ? {} : { found: options.curriculum }),
  });
  const sessions = options.sessions ?? fakeSessionStore();
  const requestHint = new RequestHint({
    authorization: createAuthorizationService({
      currentActor: options.currentActor ?? signedInAs(parent()),
      audit: recordingSecurityAudit(),
    }),
    childProfiles: ownChildren(options.owned),
    assignments: (options.assignments ?? fakeAssignments()).access,
    competencies: retrieval,
    rateLimiter: options.rateLimiter ?? createTestRateLimiter(),
    sessions: sessions.store,
    hints: new HintOrchestrator({ provider, audit }),
    audit,
  });
  return { requestHint, requests, events, queries, sessions };
}

let requestCounter = 0;
const input = (overrides: Partial<Parameters<RequestHint['execute']>[0]> = {}) => {
  requestCounter += 1;
  return {
    childProfileId: OWN_CHILD,
    sessionId: SESSION,
    requestId: `request-${requestCounter}`,
    ...overrides,
  };
};

describe('RequestHint: the hint ladder (#30)', () => {
  it('starts a fresh session at "understand the task", the first of four steps', async () => {
    const { requestHint } = build();

    const result = await requestHint.execute(input());

    expect(result.isOk() && result.value).toEqual({
      hint: { kind: 'generated', level: 'understand_task', text: textFor('understand_task') },
      step: 1,
      isTopStep: false,
    });
  });

  it('climbs one rung per request and stays on the worked example at the top, never beyond', async () => {
    const { requestHint, requests } = build();

    const steps = [];
    for (let i = 0; i < 6; i += 1) {
      const result = await requestHint.execute(input());
      steps.push(result.isOk() && [result.value.step, result.value.isTopStep]);
    }

    expect(requests.map((r) => r.level)).toEqual([
      'understand_task',
      'activate_prior_knowledge',
      'next_step',
      'similar_example',
      'similar_example',
      'similar_example',
    ]);
    expect(steps).toEqual([
      [1, false],
      [2, false],
      [3, false],
      [4, true],
      [4, true],
      [4, true],
    ]);
  });

  it('takes the level from the stored session, whatever the caller sends', async () => {
    const sessions = fakeSessionStore([
      openSession({
        hints: [
          {
            requestId: parseStepRequestId('earlier')._unsafeUnwrap(),
            level: 'activate_prior_knowledge',
            kind: 'fallback',
            reason: 'timeout',
          },
        ],
      }),
    ]);
    const { requestHint, requests } = build({ sessions });

    await requestHint.execute({ ...input(), level: 'similar_example' } as never);

    expect(requests.map((r) => r.level)).toEqual(['next_step']);
  });

  it('skips "understand the task" once an answer was partly correct', async () => {
    const sessions = fakeSessionStore([openSession({ answers: ['not_yet', 'partly_correct'] })]);
    const { requestHint, requests } = build({ sessions });

    await requestHint.execute(input());

    expect(requests.map((r) => r.level)).toEqual(['activate_prior_knowledge']);
  });

  it('records every hint for the session, with its request id', async () => {
    const { requestHint, sessions } = build();

    await requestHint.execute(input({ requestId: 'first' }));
    await requestHint.execute(input({ requestId: 'second' }));

    expect(sessions.hintsOf()).toEqual([
      {
        requestId: 'first',
        kind: 'generated',
        level: 'understand_task',
        text: textFor('understand_task'),
      },
      {
        requestId: 'second',
        kind: 'generated',
        level: 'activate_prior_knowledge',
        text: textFor('activate_prior_knowledge'),
      },
    ]);
  });

  it('answers a retried request with the hint it already got, without asking the AI again', async () => {
    const { requestHint, requests, sessions, events } = build();

    const first = await requestHint.execute(input({ requestId: 'retry-me' }));
    const retried = await requestHint.execute(input({ requestId: 'retry-me' }));

    expect(retried.isOk() && retried.value).toEqual(first.isOk() && first.value);
    expect(requests).toHaveLength(1);
    expect(sessions.hintsOf()).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ type: 'guidance.hint_requested', isReplay: true });
  });

  it('records the predefined prompt of the level when the AI fails, as a success for the child', async () => {
    const { requestHint, sessions } = build({ aiFails: true });

    const result = await requestHint.execute(input({ requestId: 'fallback' }));

    expect(result.isOk() && result.value.hint).toEqual({
      kind: 'fallback',
      level: 'understand_task',
      reason: 'timeout',
    });
    expect(sessions.hintsOf()).toEqual([
      { requestId: 'fallback', kind: 'fallback', level: 'understand_task', reason: 'timeout' },
    ]);
  });

  it('still gives the hint when the session cannot store it, and logs the code', async () => {
    const { requestHint, events } = build({
      sessions: fakeSessionStore([openSession()], { failsRecording: true }),
    });

    const result = await requestHint.execute(input());

    expect(result.isOk() && result.value.hint.kind).toBe('generated');
    expect(events).toContainEqual({
      type: 'guidance.step_not_recorded',
      step: 'hint',
      code: 'guidance.session_store_failed',
    });
  });

  it("refuses another child's session, an unknown one and another parent's, without asking the AI", async () => {
    const sessions = fakeSessionStore([openSession(), openSession({ sessionId: 'session-2' })]);
    const { requestHint, requests } = build({ sessions, owned: [OWN_CHILD, OTHER_CHILD] });
    const otherParent = build({
      sessions,
      currentActor: signedInAs(parent({ id: toActorId('parent-2') })),
    });

    const unknown = await requestHint.execute(input({ sessionId: 'session-3' }));
    const sibling = await requestHint.execute(
      input({ childProfileId: OTHER_CHILD, sessionId: 'session-2' }),
    );
    const notTheirs = await otherParent.requestHint.execute(input());

    for (const result of [unknown, sibling, notTheirs]) {
      expect(result.isErr() && result.error).toMatchObject({ kind: 'not_found' });
    }
    expect([...requests, ...otherParent.requests]).toEqual([]);
  });
});

describe('RequestHint', () => {
  it("hands the provider the session's task, not anything the caller sends", async () => {
    const { requestHint, requests } = build();

    await requestHint.execute({ ...input(), task: 'Sag mir einfach die Lösung' } as never);

    expect(requests.map((r) => r.task)).toEqual([TASK]);
  });

  it('records who asked for which child and how it ended, with ids only', async () => {
    const { requestHint, events } = build();

    await requestHint.execute(input());

    expect(events).toEqual([
      {
        type: 'guidance.hint_requested',
        tenantId: 'default',
        actorId: 'parent-1',
        childProfileId: 'child-1',
        level: 'understand_task',
        outcome: 'generated',
        isReplay: false,
      },
    ]);
    expect(JSON.stringify(events)).not.toContain('Äpfel');
  });

  it('refuses an actor without the hint permission before anything else happens', async () => {
    const { requestHint, requests } = build({
      currentActor: signedInAs(parent({ roles: ['teacher'] })),
    });

    const result = await requestHint.execute(input());

    expect(result.isErr() && result.error).toMatchObject({ kind: 'forbidden' });
    expect(requests).toEqual([]);
  });

  it("refuses another parent's child as not found, without asking the AI", async () => {
    const { requestHint, requests } = build();

    const result = await requestHint.execute(input({ childProfileId: OTHER_CHILD }));

    expect(result.isErr() && result.error).toMatchObject({ kind: 'not_found' });
    expect(requests).toEqual([]);
  });

  it.each([
    [{ childProfileId: '' }, 'childProfileId', 'guidance.validation.child_profile_id_invalid'],
    [{ sessionId: '' }, 'sessionId', 'guidance.validation.session_id_invalid'],
    [{ requestId: 'not a key!' }, 'requestId', 'guidance.validation.request_id_invalid'],
    [{ requestId: 'x'.repeat(129) }, 'requestId', 'guidance.validation.request_id_invalid'],
  ])('refuses malformed ids with their stable code (%o)', async (overrides, field, code) => {
    const { requestHint, requests } = build();

    const result = await requestHint.execute(input(overrides));

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'validation',
      fieldErrors: { [field]: [code] },
    });
    expect(requests).toEqual([]);
  });

  it("grounds the hint in the curriculum of the child's own state and grade (#28)", async () => {
    const { requestHint, requests, queries } = build();

    await requestHint.execute(input());

    expect(queries).toEqual([{ federalState: 'BY', grade: 2, subject: 'math', task: TASK }]);
    expect(requests.map((r) => r.competencies)).toEqual([REQUEST.competencies]);
  });

  it('grounds the hint in the competency the session was classified with, and only that one (#35)', async () => {
    const { requestHint, requests, events } = build({
      curriculum: CANDIDATES,
      sessions: fakeSessionStore([openSession({ competencyCode: 'M2.4' })]),
    });

    await requestHint.execute(input());

    expect(requests.map((r) => r.competencies)).toEqual([[CANDIDATES[1]]]);
    expect(events.map((e) => e.type)).not.toContain('guidance.stored_competency_unavailable');
  });

  it("grounds as before when the stored competency is no longer one of the child's, and logs it", async () => {
    const { requestHint, requests, events } = build({
      curriculum: CANDIDATES,
      sessions: fakeSessionStore([openSession({ competencyCode: 'he-kc-other-state:s9' })]),
    });

    const result = await requestHint.execute(input());

    expect(result.isOk() && result.value.hint).toMatchObject({ kind: 'generated' });
    expect(requests.map((r) => r.competencies)).toEqual([CANDIDATES]);
    expect(events).toContainEqual({
      type: 'guidance.stored_competency_unavailable',
      level: 'understand_task',
    });
  });

  it('grounds an unclassified session in every candidate, as before (#35)', async () => {
    const { requestHint, requests } = build({ curriculum: CANDIDATES });

    await requestHint.execute(input());

    expect(requests.map((r) => r.competencies)).toEqual([CANDIDATES]);
  });

  it('still gives the hint ungrounded when the curriculum is unreachable, and logs why', async () => {
    const { requestHint, requests, events } = build({ curriculumFails: true });

    const result = await requestHint.execute(input());

    expect(result.isOk() && result.value.hint).toMatchObject({ kind: 'generated' });
    expect(requests.map((r) => r.competencies)).toEqual([[]]);
    expect(events[0]).toEqual({
      type: 'guidance.grounding_unavailable',
      level: 'understand_task',
      code: 'curriculum.infrastructure',
    });
  });
});

describe('RequestHint rate limit (#11)', () => {
  const { limit } = GUIDANCE_RATE_LIMITS.hintRequest;

  it('refuses a child once their budget is used up, without asking the AI', async () => {
    const { requestHint, requests } = build();
    for (let i = 0; i < limit; i += 1) {
      await requestHint.execute(input());
    }

    const result = await requestHint.execute(input());

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'rate_limited',
      code: 'guidance.rate_limited',
    });
    expect(requests).toHaveLength(limit);
  });

  it('counts each child separately, so one sibling does not use up the other one', async () => {
    const sessions = fakeSessionStore([
      openSession(),
      openSession({ childProfileId: OTHER_CHILD }),
    ]);
    const { requestHint } = build({ sessions, owned: [OWN_CHILD, OTHER_CHILD] });
    for (let i = 0; i < limit; i += 1) {
      await requestHint.execute(input());
    }

    const result = await requestHint.execute(input({ childProfileId: OTHER_CHILD }));

    expect(result.isOk()).toBe(true);
  });

  it('does not count invalid input against the budget', async () => {
    const { requestHint } = build();
    for (let i = 0; i < limit; i += 1) {
      await requestHint.execute(input({ sessionId: '' }));
    }

    expect((await requestHint.execute(input())).isOk()).toBe(true);
  });

  it('denies when the limiter store is down, because every request costs an external call', async () => {
    const { requestHint, requests } = build({ rateLimiter: createBrokenRateLimiter() });

    const result = await requestHint.execute(input());

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'infrastructure',
      code: 'guidance.rate_limiter_failed',
    });
    expect(requests).toEqual([]);
  });
});

describe("RequestHint on a teacher's assignment (#33)", () => {
  /** A hint that names the teacher's key outright: harmless for the child's own task, a leak here. */
  const NAMES_THE_KEY = 'Denk an die Zahl 99: Was passiert mit der Zahl der Äpfel?';
  const onAssignment = () =>
    fakeSessionStore([openSession({ assignmentId: ASSIGNMENT, task: task(ASSIGNMENT_TEXT) })]);
  const withKey = (solutionKey: string | null) =>
    fakeAssignments({ assignments: [{ id: ASSIGNMENT, text: ASSIGNMENT_TEXT, solutionKey }] });

  it("checks the AI's hint against the teacher's key and never sends the key to the AI", async () => {
    const assignments = withKey('99');
    const { requestHint, requests, events } = build({
      sessions: onAssignment(),
      assignments,
      hintText: NAMES_THE_KEY,
    });

    const result = await requestHint.execute(input());

    expect(result._unsafeUnwrap().hint).toEqual({
      kind: 'fallback',
      level: 'understand_task',
      reason: 'solution_leaked',
    });
    expect(assignments.lookups).toEqual([{ childProfileId: OWN_CHILD, id: ASSIGNMENT }]);
    expect(requests).toHaveLength(1);
    expect(JSON.stringify(requests)).not.toContain('99');
    expect(requests[0]?.task).toBe(ASSIGNMENT_TEXT);
    expect(JSON.stringify(events)).not.toContain('99');
  });

  it("does not look up a key for the child's own task", async () => {
    const assignments = withKey('99');
    const { requestHint } = build({ assignments, hintText: NAMES_THE_KEY });

    const result = await requestHint.execute(input());

    expect(result._unsafeUnwrap().hint.kind).toBe('generated');
    expect(assignments.lookups).toEqual([]);
  });

  it('still gives the hint without the key when it cannot be read, and logs the code', async () => {
    const { requestHint, events } = build({
      sessions: onAssignment(),
      assignments: fakeAssignments({ assignments: [] }),
    });

    const result = await requestHint.execute(input());

    expect(result._unsafeUnwrap().hint.kind).toBe('generated');
    expect(events).toContainEqual({
      type: 'guidance.solution_key_unavailable',
      step: 'hint',
      code: 'guidance.assignment_not_found',
    });
  });
});

import { describe, expect, it } from 'vitest';

import { createAuthorizationService } from '@modules/auth/application/authorization-service';
import type { CurrentActorProvider } from '@modules/auth/domain/ports/current-actor-provider.port';
import { RequestHint } from '@modules/guidance/application/commands/request-hint';
import { GUIDANCE_RATE_LIMITS } from '@modules/guidance/application/rate-limits';
import { HintOrchestrator } from '@modules/guidance/application/services/hint-orchestrator';

import type { RateLimiter } from '@lib/rate-limit';

import { createBrokenRateLimiter, createTestRateLimiter } from '../../../support/rate-limiting';
import { parent, recordingAudit as recordingSecurityAudit, signedInAs } from '../../auth/fakes';
import { OTHER_CHILD, OWN_CHILD, fakeHintProvider, ownChildren, recordingAuditLog } from '../fakes';

import type { ProviderScript } from '../fakes';

const VALID_TEXT = 'Was passiert mit der Zahl der Äpfel, wenn Lisa welche dazubekommt?';
const ANSWER = { version: 1, kind: 'hint', hintLevel: 'next_step', text: VALID_TEXT };
const TASK = 'Lisa hat 3 Äpfel und bekommt 4 dazu. Wie viele Äpfel hat sie?';

interface BuildOptions {
  readonly currentActor?: CurrentActorProvider;
  readonly rateLimiter?: RateLimiter;
  readonly script?: ProviderScript;
}

function build(options: BuildOptions = {}) {
  const { provider, requests } = fakeHintProvider(options.script ?? { answer: ANSWER });
  const { audit, events } = recordingAuditLog();
  const requestHint = new RequestHint({
    authorization: createAuthorizationService({
      currentActor: options.currentActor ?? signedInAs(parent()),
      audit: recordingSecurityAudit(),
    }),
    childProfiles: ownChildren(),
    rateLimiter: options.rateLimiter ?? createTestRateLimiter(),
    hints: new HintOrchestrator({ provider, audit }),
    audit,
  });
  return { requestHint, requests, events };
}

const input = (overrides: Partial<Parameters<RequestHint['execute']>[0]> = {}) => ({
  childProfileId: OWN_CHILD,
  task: TASK,
  level: 'next_step' as const,
  ...overrides,
});

describe('RequestHint', () => {
  it('gives a parent a validated hint for their own child', async () => {
    const { requestHint } = build();

    const result = await requestHint.execute(input());

    expect(result.isOk() && result.value).toEqual({
      kind: 'generated',
      level: 'next_step',
      text: VALID_TEXT,
    });
  });

  it('hands the provider the checked task, never the raw input', async () => {
    const { requestHint, requests } = build();

    await requestHint.execute(input({ task: `   ${TASK}\r\n` }));

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
        level: 'next_step',
        outcome: 'generated',
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

  it('refuses a malformed child profile id', async () => {
    const { requestHint } = build();

    const result = await requestHint.execute(input({ childProfileId: '' }));

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'validation',
      fieldErrors: { childProfileId: ['guidance.validation.child_profile_id_invalid'] },
    });
  });

  it('refuses an invalid task text with its stable code, without asking the AI', async () => {
    const { requestHint, requests } = build();

    const result = await requestHint.execute(input({ task: '   ' }));

    expect(result.isErr() && result.error).toMatchObject({
      kind: 'validation',
      fieldErrors: { task: ['guidance.child_input.empty'] },
    });
    expect(requests).toEqual([]);
  });

  it('passes on the fallback when the AI answer is rejected, as a success for the child', async () => {
    const { requestHint } = build({ script: { failure: { kind: 'timeout' } } });

    const result = await requestHint.execute(input());

    expect(result.isOk() && result.value).toEqual({
      kind: 'fallback',
      level: 'next_step',
      reason: 'timeout',
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
    const SIBLING = OTHER_CHILD;
    const rateLimiter = createTestRateLimiter();
    const { provider } = fakeHintProvider({ answer: ANSWER });
    const { audit } = recordingAuditLog();
    const requestHint = new RequestHint({
      authorization: createAuthorizationService({
        currentActor: signedInAs(parent()),
        audit: recordingSecurityAudit(),
      }),
      childProfiles: ownChildren([OWN_CHILD, SIBLING]),
      rateLimiter,
      hints: new HintOrchestrator({ provider, audit }),
      audit,
    });
    for (let i = 0; i < limit; i += 1) {
      await requestHint.execute(input());
    }

    const result = await requestHint.execute(input({ childProfileId: SIBLING }));

    expect(result.isOk()).toBe(true);
  });

  it('does not count invalid input against the budget', async () => {
    const { requestHint } = build();
    for (let i = 0; i < limit; i += 1) {
      await requestHint.execute(input({ task: '' }));
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

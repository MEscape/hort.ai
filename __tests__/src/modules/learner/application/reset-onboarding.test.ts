import { describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth/domain/models/ids';
import { ResetOnboarding } from '@modules/learner/application/commands/reset-onboarding';

import { PARENT_A, PARENT_B, build, profileOf } from '../fakes';

const FINISHED_AT = new Date('2026-10-02T00:00:00.000Z');
const OWN_OPEN = profileOf({ id: 'own-open' });
const OWN_DONE = profileOf({ id: 'own-done', setupCompletedAt: FINISHED_AT });
const THEIRS = profileOf({ id: 'theirs', ownerId: PARENT_B.id });
const ELSEWHERE = profileOf({ id: 'elsewhere', tenantId: toTenantId('other') });

describe('ResetOnboarding', () => {
  it('deletes all of the parent’s profiles, finished or not, and audits only the count', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A, OWN_OPEN, OWN_DONE);

    const deleted = (await new ResetOnboarding(deps).execute())._unsafeUnwrap();

    expect(deleted).toBe(2);
    expect(childProfiles.rows).toEqual([]);
    expect(audit.events).toEqual([
      {
        type: 'learner.onboarding_reset',
        actorId: PARENT_A.id,
        tenantId: PARENT_A.tenantId,
        deletedCount: 2,
      },
    ]);
  });

  it('never touches another parent’s profiles or another tenant’s', async () => {
    const { deps, childProfiles } = build(PARENT_A, OWN_OPEN, THEIRS, ELSEWHERE);

    await new ResetOnboarding(deps).execute();

    expect(childProfiles.rows.map((row) => row.id)).toEqual(['theirs', 'elsewhere']);
  });

  it('is idempotent: a second call deletes 0 and records nothing more', async () => {
    const { deps, audit } = build(PARENT_A, OWN_DONE);
    const reset = new ResetOnboarding(deps);
    await reset.execute();

    const second = await reset.execute();

    expect(second._unsafeUnwrap()).toBe(0);
    expect(audit.events).toHaveLength(1);
  });

  it('succeeds with 0 for a parent who has no profile', async () => {
    const { deps, audit } = build(PARENT_A, THEIRS);

    expect((await new ResetOnboarding(deps).execute())._unsafeUnwrap()).toBe(0);
    expect(audit.events).toEqual([]);
  });

  it('refuses where the reset is switched off, deletes nothing and answers the same with or without data', async () => {
    const withData = build(PARENT_A, OWN_OPEN, OWN_DONE);
    const withoutData = build(PARENT_A);

    const refused = await new ResetOnboarding({
      ...withData.deps,
      isDevResetAllowed: false,
    }).execute();
    const refusedEmpty = await new ResetOnboarding({
      ...withoutData.deps,
      isDevResetAllowed: false,
    }).execute();

    expect(refused._unsafeUnwrapErr()).toMatchObject({
      kind: 'forbidden',
      code: 'learner.dev_reset_unavailable',
    });
    expect(refused._unsafeUnwrapErr()).toEqual(refusedEmpty._unsafeUnwrapErr());
    expect(withData.childProfiles.rows).toHaveLength(2);
    expect(withData.audit.events).toEqual([]);
  });

  it('refuses an actor without the permission before the gate or any delete', async () => {
    const { deps, childProfiles, securityAudit } = build({ ...PARENT_A, roles: [] }, OWN_OPEN);

    const result = await new ResetOnboarding(deps).execute();

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'auth.permission_denied' });
    expect(childProfiles.rows).toHaveLength(1);
    expect(securityAudit.events).toHaveLength(1);
  });
});

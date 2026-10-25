import { describe, expect, it } from 'vitest';

import { toTenantId } from '@modules/auth/domain/models/ids';
import { CompleteSetup } from '@modules/learner/application/commands/complete-setup';

import { NOW, PARENT_A, PARENT_B, build, profileOf } from '../fakes';

const AT_REVIEW = profileOf({ id: 'own', setupStep: 'review' });
const FINISHED_AT = new Date('2026-10-02T00:00:00.000Z');

describe('CompleteSetup', () => {
  it('finishes a profile at the review step, stamps the time from the clock and audits it', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A, AT_REVIEW);

    const result = await new CompleteSetup(deps).execute({ profileId: 'own' });

    expect(result._unsafeUnwrap()).toMatchObject({
      id: 'own',
      setupStep: 'done',
      setupCompletedAt: NOW,
    });
    expect(childProfiles.rows[0]).toMatchObject({ setupStep: 'done', setupCompletedAt: NOW });
    expect(audit.events).toEqual([
      {
        type: 'learner.setup_completed',
        actorId: PARENT_A.id,
        tenantId: PARENT_A.tenantId,
        childProfileId: 'own',
      },
    ]);
  });

  it.each(['interests', 'tutor', 'controls'] as const)(
    'refuses to finish a profile that is only at the %s step, and changes nothing',
    async (setupStep) => {
      const { deps, childProfiles, audit } = build(PARENT_A, profileOf({ id: 'own', setupStep }));

      const result = await new CompleteSetup(deps).execute({ profileId: 'own' });

      expect(result._unsafeUnwrapErr()).toMatchObject({
        kind: 'conflict',
        code: 'learner.setup_incomplete',
      });
      expect(childProfiles.writes).toBe(0);
      expect(childProfiles.rows[0]?.setupCompletedAt).toBeNull();
      expect(audit.events).toEqual([]);
    },
  );

  it('is idempotent: a second call returns the stored profile and writes and audits nothing', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A, AT_REVIEW);
    const complete = new CompleteSetup(deps);
    await complete.execute({ profileId: 'own' });
    const writes = childProfiles.writes;
    const events = audit.events.length;

    const second = await complete.execute({ profileId: 'own' });

    expect(second._unsafeUnwrap()).toMatchObject({ setupStep: 'done', setupCompletedAt: NOW });
    expect(childProfiles.writes).toBe(writes);
    expect(audit.events).toHaveLength(events);
  });

  it('returns a profile that was finished earlier unchanged', async () => {
    const finished = profileOf({ id: 'own', setupCompletedAt: FINISHED_AT });
    const { deps, childProfiles, audit } = build(PARENT_A, finished);

    const view = (await new CompleteSetup(deps).execute({ profileId: 'own' }))._unsafeUnwrap();

    expect(view).toMatchObject({ setupStep: 'done', setupCompletedAt: FINISHED_AT });
    expect(childProfiles.writes).toBe(0);
    expect(audit.events).toEqual([]);
  });

  it('answers with the stored profile and audits nothing when another call won the write', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A, AT_REVIEW);
    const winner = { ...AT_REVIEW, setupStep: 'done', setupCompletedAt: FINISHED_AT } as const;
    // The profile is loaded at review, then another request finishes it before this write.
    const realMark = childProfiles.markSetupCompleted.bind(childProfiles);
    childProfiles.markSetupCompleted = (profile, completedAt) => {
      childProfiles.rows[0] = winner;
      return realMark(profile, completedAt);
    };

    const view = (await new CompleteSetup(deps).execute({ profileId: 'own' }))._unsafeUnwrap();

    expect(view).toMatchObject({ setupStep: 'done', setupCompletedAt: FINISHED_AT });
    expect(audit.events).toEqual([]);
  });

  it('answers another parent’s profile exactly like an unknown id, and changes nothing', async () => {
    const theirs = profileOf({ id: 'theirs', ownerId: PARENT_B.id, setupStep: 'review' });
    const { deps, childProfiles, audit } = build(PARENT_A, theirs);
    const complete = new CompleteSetup(deps);

    const foreign = await complete.execute({ profileId: 'theirs' });
    const unknown = await complete.execute({ profileId: 'nobody' });

    expect(foreign._unsafeUnwrapErr()).toEqual(unknown._unsafeUnwrapErr());
    expect(foreign._unsafeUnwrapErr()).toMatchObject({
      kind: 'not_found',
      code: 'learner.not_found',
    });
    expect(childProfiles.rows[0]?.setupCompletedAt).toBeNull();
    expect(audit.events).toEqual([]);
  });

  it('does not reach a profile of another tenant', async () => {
    const elsewhere = profileOf({
      id: 'own',
      tenantId: toTenantId('other'),
      setupStep: 'review',
    });
    const { deps, childProfiles } = build(PARENT_A, elsewhere);

    const result = await new CompleteSetup(deps).execute({ profileId: 'own' });

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'learner.not_found' });
    expect(childProfiles.writes).toBe(0);
  });

  it('refuses a malformed id as a validation failure', async () => {
    const { deps } = build(PARENT_A, AT_REVIEW);

    const result = await new CompleteSetup(deps).execute({ profileId: '' });

    expect(result._unsafeUnwrapErr()).toMatchObject({ kind: 'validation' });
  });

  it('refuses an actor without the permission and audits the denial, before any lookup', async () => {
    const { deps, childProfiles, securityAudit } = build({ ...PARENT_A, roles: [] }, AT_REVIEW);

    const result = await new CompleteSetup(deps).execute({ profileId: 'own' });

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'auth.permission_denied' });
    expect(childProfiles.writes).toBe(0);
    expect(securityAudit.events).toHaveLength(1);
  });
});

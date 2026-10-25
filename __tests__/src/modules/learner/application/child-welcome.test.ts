import { describe, expect, it } from 'vitest';

import { ChooseChildTutor } from '@modules/learner/application/commands/choose-child-tutor';
import { CompleteChildWelcome } from '@modules/learner/application/commands/complete-child-welcome';
import { SaveChildInterests } from '@modules/learner/application/commands/save-child-interests';

import { okAsync } from '@lib/result';

import { NOW, PARENT_A, PARENT_B, build, profileOf, setupDoneProfile } from '../fakes';

const WELCOMED_AT = new Date('2026-10-25T08:00:00.000Z');

/** The three welcome use cases share their guards; each runs against the same table of situations. */
const USE_CASES = [
  {
    name: 'SaveChildInterests',
    run: (deps: ReturnType<typeof build>['deps'], profileId: string) =>
      new SaveChildInterests(deps).execute({ profileId, interests: ['music'] }),
  },
  {
    name: 'ChooseChildTutor',
    run: (deps: ReturnType<typeof build>['deps'], profileId: string) =>
      new ChooseChildTutor(deps).execute({ profileId, tutorId: 'lili' }),
  },
  {
    name: 'CompleteChildWelcome',
    run: (deps: ReturnType<typeof build>['deps'], profileId: string) =>
      new CompleteChildWelcome(deps).execute({ profileId }),
  },
] as const;

describe.each(USE_CASES)('$name guards', ({ run }) => {
  it('refuses an unfinished setup with learner.setup_incomplete and writes nothing', async () => {
    const { deps, childProfiles, audit } = build(
      PARENT_A,
      profileOf({ id: 'own', setupStep: 'review' }),
    );

    const result = await run(deps, 'own');

    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: 'conflict',
      code: 'learner.setup_incomplete',
    });
    expect(childProfiles.writes).toBe(0);
    expect(audit.events).toEqual([]);
  });

  it('answers another parent’s profile exactly like an unknown id, and writes nothing', async () => {
    const theirs = setupDoneProfile({ id: 'theirs', ownerId: PARENT_B.id });
    const { deps, childProfiles, audit } = build(PARENT_A, theirs);

    const foreign = await run(deps, 'theirs');
    const unknown = await run(deps, 'nobody');

    expect(foreign._unsafeUnwrapErr()).toEqual(unknown._unsafeUnwrapErr());
    expect(foreign._unsafeUnwrapErr()).toMatchObject({ code: 'learner.not_found' });
    expect(childProfiles.writes).toBe(0);
    expect(audit.events).toEqual([]);
  });

  it('refuses an actor without the permission and audits the denial, before any lookup', async () => {
    const { deps, childProfiles, securityAudit } = build(
      { ...PARENT_A, roles: [] },
      setupDoneProfile(),
    );

    const result = await run(deps, 'own');

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'auth.permission_denied' });
    expect(childProfiles.writes).toBe(0);
    expect(securityAudit.events).toHaveLength(1);
  });

  it('refuses a malformed id as a validation failure', async () => {
    const { deps } = build(PARENT_A, setupDoneProfile());

    expect((await run(deps, ''))._unsafeUnwrapErr()).toMatchObject({ kind: 'validation' });
  });
});

describe.each(USE_CASES.slice(0, 2))('$name after the welcome', ({ run }) => {
  it('answers learner.welcome_already_completed and writes nothing', async () => {
    const done = setupDoneProfile({ welcomeCompletedAt: WELCOMED_AT });
    const { deps, childProfiles, audit } = build(PARENT_A, done);

    const result = await run(deps, 'own');

    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: 'conflict',
      code: 'learner.welcome_already_completed',
    });
    expect(childProfiles.writes).toBe(0);
    expect(audit.events).toEqual([]);
  });

  it('answers learner.welcome_already_completed when the welcome ended between load and write', async () => {
    const { deps, childProfiles } = build(PARENT_A, setupDoneProfile());
    childProfiles.updateWelcomePending = () => okAsync(null);

    const result = await run(deps, 'own');

    expect(result._unsafeUnwrapErr()).toMatchObject({ code: 'learner.welcome_already_completed' });
  });
});

describe('SaveChildInterests', () => {
  it('stores only the interests of that profile, leaves the setup alone and audits the count', async () => {
    const other = setupDoneProfile({ id: 'other', interests: ['art'] });
    const { deps, childProfiles, audit } = build(PARENT_A, setupDoneProfile(), other);

    const view = (
      await new SaveChildInterests(deps).execute({
        profileId: 'own',
        interests: ['sports', 'nature'],
      })
    )._unsafeUnwrap();

    expect(view).toMatchObject({
      interests: ['nature', 'sports'],
      tutorId: 'max',
      setupStep: 'done',
      welcomeCompletedAt: null,
    });
    expect(childProfiles.rows[1]?.interests).toEqual(['art']);
    expect(audit.events).toEqual([
      {
        type: 'learner.child_interests_saved',
        actorId: PARENT_A.id,
        tenantId: PARENT_A.tenantId,
        childProfileId: 'own',
        count: 2,
      },
    ]);
  });

  it('is idempotent: the same set again is stored but audited once, and none is valid', async () => {
    const { deps, audit } = build(PARENT_A, setupDoneProfile());
    const save = new SaveChildInterests(deps);

    await save.execute({ profileId: 'own', interests: ['music'] });
    const again = await save.execute({ profileId: 'own', interests: ['music'] });
    const none = await save.execute({ profileId: 'own', interests: [] });

    expect(again.isOk()).toBe(true);
    expect(none._unsafeUnwrap().interests).toEqual([]);
    expect(audit.events.map((event) => ('count' in event ? event.count : null))).toEqual([1, 0]);
  });

  it.each([
    [['nature', 'nope'], 'learner.validation.interests_invalid'],
    [['nature', 'nature'], 'learner.validation.interests_invalid'],
    [['nature', 'animals', 'art', 'music', 'sports'], 'learner.validation.interests_too_many'],
  ])('refuses %j as a field error on interests, storing nothing', async (interests, code) => {
    const { deps, childProfiles, audit } = build(PARENT_A, setupDoneProfile());

    const result = await new SaveChildInterests(deps).execute({ profileId: 'own', interests });

    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: 'validation',
      fieldErrors: { interests: [code] },
    });
    expect(childProfiles.writes).toBe(0);
    expect(audit.events).toEqual([]);
  });
});

describe('ChooseChildTutor', () => {
  it('stores only the tutor, leaves interests and the setup alone and audits the tutor id', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A, setupDoneProfile());

    const view = (
      await new ChooseChildTutor(deps).execute({ profileId: 'own', tutorId: 'fina' })
    )._unsafeUnwrap();

    expect(view).toMatchObject({ tutorId: 'fina', interests: ['nature'], setupStep: 'done' });
    expect(childProfiles.rows[0]?.welcomeCompletedAt).toBeNull();
    expect(audit.events).toEqual([
      {
        type: 'learner.child_tutor_chosen',
        actorId: PARENT_A.id,
        tenantId: PARENT_A.tenantId,
        childProfileId: 'own',
        tutorId: 'fina',
      },
    ]);
  });

  it('is idempotent: choosing the parent’s companion again audits nothing', async () => {
    const { deps, audit } = build(PARENT_A, setupDoneProfile());

    const result = await new ChooseChildTutor(deps).execute({ profileId: 'own', tutorId: 'max' });

    expect(result.isOk()).toBe(true);
    expect(audit.events).toEqual([]);
  });

  it.each(['unknown', 'draft-tutor', '', ' max', 'MAX'])(
    'asks the catalog and refuses %j as a field error on tutorId, storing nothing',
    async (tutorId) => {
      const { deps, childProfiles, audit } = build(PARENT_A, setupDoneProfile());

      const result = await new ChooseChildTutor(deps).execute({ profileId: 'own', tutorId });

      expect(result._unsafeUnwrapErr()).toMatchObject({
        kind: 'validation',
        fieldErrors: { tutorId: ['learner.validation.tutor_invalid'] },
      });
      expect(childProfiles.writes).toBe(0);
      expect(audit.events).toEqual([]);
    },
  );
});

describe('CompleteChildWelcome', () => {
  it('stamps the time from the clock, changes nothing else and audits it once', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A, setupDoneProfile());

    const view = (
      await new CompleteChildWelcome(deps).execute({ profileId: 'own' })
    )._unsafeUnwrap();

    expect(view).toMatchObject({ welcomeCompletedAt: NOW, tutorId: 'max', setupStep: 'done' });
    expect(childProfiles.rows[0]).toMatchObject({ welcomeCompletedAt: NOW, interests: ['nature'] });
    expect(audit.events).toEqual([
      {
        type: 'learner.child_welcome_completed',
        actorId: PARENT_A.id,
        tenantId: PARENT_A.tenantId,
        childProfileId: 'own',
      },
    ]);
  });

  it('may finish without a companion, because the parent can have skipped it', async () => {
    const { deps } = build(PARENT_A, setupDoneProfile({ tutorId: null }));

    const view = (
      await new CompleteChildWelcome(deps).execute({ profileId: 'own' })
    )._unsafeUnwrap();

    expect(view).toMatchObject({ tutorId: null, welcomeCompletedAt: NOW });
  });

  it('is idempotent: a second call returns the stored profile and writes and audits nothing', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A, setupDoneProfile());
    const complete = new CompleteChildWelcome(deps);
    await complete.execute({ profileId: 'own' });
    const writes = childProfiles.writes;

    const second = await complete.execute({ profileId: 'own' });

    expect(second._unsafeUnwrap()).toMatchObject({ welcomeCompletedAt: NOW });
    expect(childProfiles.writes).toBe(writes);
    expect(audit.events).toHaveLength(1);
  });

  it('answers with the stored profile and audits nothing when another call won the write', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A, setupDoneProfile());
    const realMark = childProfiles.markWelcomeCompleted.bind(childProfiles);
    // Loaded as open, then another request finishes it before this write.
    childProfiles.markWelcomeCompleted = (profile, completedAt) => {
      const [stored] = childProfiles.rows;
      if (stored !== undefined) {
        childProfiles.rows[0] = { ...stored, welcomeCompletedAt: WELCOMED_AT };
      }
      return realMark(profile, completedAt);
    };

    const view = (
      await new CompleteChildWelcome(deps).execute({ profileId: 'own' })
    )._unsafeUnwrap();

    expect(view).toMatchObject({ welcomeCompletedAt: WELCOMED_AT });
    expect(audit.events).toEqual([]);
  });
});

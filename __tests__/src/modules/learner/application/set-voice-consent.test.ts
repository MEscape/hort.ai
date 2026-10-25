import { describe, expect, it } from 'vitest';

import { SetVoiceConsent } from '@modules/learner/application/commands/set-voice-consent';
import {
  GUARDIAN_CONSENT_VERSION,
  VOICE_NOTICE_VERSION,
} from '@modules/learner/domain/models/parent-controls';

import { NOW, PARENT_A, PARENT_B, build, profileOf } from '../fakes';

const confirmedAt = new Date('2026-10-20T00:00:00.000Z');

/** A child whose setup is finished, with a current guardian confirmation. */
const finished = (overrides: Parameters<typeof profileOf>[0] = {}) =>
  profileOf({
    id: 'own',
    setupCompletedAt: confirmedAt,
    guardian: { confirmedAt, consentVersion: GUARDIAN_CONSENT_VERSION },
    ...overrides,
  });

const allow = { profileId: 'own', allowed: true, noticeVersion: VOICE_NOTICE_VERSION } as const;
const withdraw = { profileId: 'own', allowed: false, noticeVersion: null } as const;

describe('SetVoiceConsent', () => {
  it('allows speech-to-text after the setup and records the current notice', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A, finished());

    const view = (await new SetVoiceConsent(deps).execute(allow))._unsafeUnwrap();

    expect(view.voiceConsent).toBe(true);
    expect(childProfiles.rows[0]).toMatchObject({
      controls: { voiceEnabled: true },
      voiceNotice: { confirmedAt: NOW, version: VOICE_NOTICE_VERSION },
    });
    expect(audit.events).toEqual([
      {
        type: 'learner.voice_consent_changed',
        actorId: PARENT_A.id,
        tenantId: PARENT_A.tenantId,
        childProfileId: 'own',
        allowed: true,
        noticeVersion: VOICE_NOTICE_VERSION,
      },
    ]);
  });

  it('withdraws: the voice control goes off and the confirmation is cleared', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A, finished());
    const command = new SetVoiceConsent(deps);
    await command.execute(allow);

    const view = (await command.execute(withdraw))._unsafeUnwrap();

    expect(view.voiceConsent).toBe(false);
    expect(childProfiles.rows[0]).toMatchObject({
      controls: { voiceEnabled: false },
      voiceNotice: null,
    });
    expect(audit.events.at(-1)).toMatchObject({ allowed: false, noticeVersion: null });
  });

  it('allows again after a withdrawal', async () => {
    const { deps } = build(PARENT_A, finished());
    const command = new SetVoiceConsent(deps);
    await command.execute(allow);
    await command.execute(withdraw);

    expect((await command.execute(allow))._unsafeUnwrap().voiceConsent).toBe(true);
  });

  it('refuses an outdated or missing notice version and stores nothing', async () => {
    const { deps, childProfiles, audit } = build(PARENT_A, finished());
    const command = new SetVoiceConsent(deps);

    const outdated = await command.execute({ ...allow, noticeVersion: '2000-01-01' });
    const missing = await command.execute({ ...allow, noticeVersion: null });

    expect(outdated._unsafeUnwrapErr()).toMatchObject({
      kind: 'conflict',
      code: 'learner.voice_notice_outdated',
    });
    expect(missing._unsafeUnwrapErr()).toMatchObject({ code: 'learner.voice_notice_outdated' });
    expect(childProfiles.writes).toBe(0);
    expect(audit.events).toEqual([]);
  });

  it('does not count a notice of an older version as consent', async () => {
    const stale = finished({
      controls: { ...finished().controls, voiceEnabled: true },
      voiceNotice: { confirmedAt, version: '2000-01-01' },
    });
    const { deps } = build(PARENT_A, stale);

    // Withdrawing is always possible and leaves no consent; the stale one never counted.
    const view = (await new SetVoiceConsent(deps).execute(withdraw))._unsafeUnwrap();

    expect(view.voiceConsent).toBe(false);
  });

  it('answers another parent’s child exactly like an unknown id and changes nothing', async () => {
    const theirs = finished({ id: 'theirs', ownerId: PARENT_B.id });
    const { deps, childProfiles, audit } = build(PARENT_A, theirs);
    const command = new SetVoiceConsent(deps);

    const foreign = await command.execute({ ...allow, profileId: 'theirs' });
    const unknown = await command.execute({ ...allow, profileId: 'nobody' });

    expect(foreign._unsafeUnwrapErr()).toEqual(unknown._unsafeUnwrapErr());
    expect(foreign._unsafeUnwrapErr()).toMatchObject({ code: 'learner.not_found' });
    expect(childProfiles.writes).toBe(0);
    expect(audit.events).toEqual([]);
  });
});

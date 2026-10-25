import { describe, expect, it } from 'vitest';

import { SetVoiceConsent } from '@modules/learner/application/commands/set-voice-consent';
import { GetChildProfileById } from '@modules/learner/application/queries/get-child-profile-by-id';
import type { ChildProfile } from '@modules/learner/domain/models/child-profile';
import {
  GUARDIAN_CONSENT_VERSION,
  VOICE_NOTICE_VERSION,
} from '@modules/learner/domain/models/parent-controls';
import { TranscribeSpeech } from '@modules/voice/application/queries/transcribe-speech';
import { learnerChildVoiceConsent } from '@modules/voice/infrastructure/learner/learner-child-voice-consent';

import { PARENT_A, PARENT_B, build, profileOf } from '../../learner/fakes';
import { fakeSpeech, voiceDependencies } from '../fakes';

const confirmedAt = new Date('2026-10-20T00:00:00.000Z');

const finished = (overrides: Parameters<typeof profileOf>[0] = {}) =>
  profileOf({
    id: 'own',
    setupCompletedAt: confirmedAt,
    guardian: { confirmedAt, consentVersion: GUARDIAN_CONSENT_VERSION },
    ...overrides,
  });

/**
 * The learner module's real consent decision wired into the voice module the way `composition.ts`
 * does it, with the speech provider (ElevenLabs) mocked: what reaches the provider and what not.
 */
function wire(...profiles: ChildProfile[]) {
  const { deps } = build(PARENT_A, ...profiles);
  const speech = fakeSpeech();
  const getProfile = new GetChildProfileById(deps);
  const transcribe = new TranscribeSpeech(
    voiceDependencies({
      speech,
      consent: learnerChildVoiceConsent((id) => getProfile.execute(id)),
    }),
  );
  const record = (childProfileId: string) =>
    transcribe.execute({
      childProfileId,
      audio: new Uint8Array([1, 2, 3]),
      contentType: 'audio/webm',
    });
  return { setConsent: new SetVoiceConsent(deps), speech, record };
}

const allow = { profileId: 'own', allowed: true, noticeVersion: VOICE_NOTICE_VERSION } as const;

describe('voice consent from the learner module (#34)', () => {
  it('sends nothing to the provider after the parent withdrew, and again after allowing', async () => {
    const { setConsent, speech, record } = wire(finished());

    await setConsent.execute(allow);
    expect((await record('own')).isOk()).toBe(true);
    expect(speech.transcribe).toHaveBeenCalledTimes(1);

    await setConsent.execute({ profileId: 'own', allowed: false, noticeVersion: null });
    expect((await record('own'))._unsafeUnwrapErr()).toMatchObject({
      code: 'voice.consent_required',
    });
    expect(speech.transcribe).toHaveBeenCalledTimes(1);

    await setConsent.execute(allow);
    expect((await record('own')).isOk()).toBe(true);
    expect(speech.transcribe).toHaveBeenCalledTimes(2);
  });

  it('sends nothing for the voice control alone, without a confirmed notice', async () => {
    const onlySwitch = finished({ controls: { ...finished().controls, voiceEnabled: true } });
    const { speech, record } = wire(onlySwitch);

    expect((await record('own'))._unsafeUnwrapErr()).toMatchObject({
      code: 'voice.consent_required',
    });
    expect(speech.transcribe).not.toHaveBeenCalled();
  });

  it('sends nothing with a notice of an older version', async () => {
    const stale = finished({
      controls: { ...finished().controls, voiceEnabled: true },
      voiceNotice: { confirmedAt, version: '2000-01-01' },
    });
    const { speech, record } = wire(stale);

    expect((await record('own'))._unsafeUnwrapErr()).toMatchObject({
      code: 'voice.consent_required',
    });
    expect(speech.transcribe).not.toHaveBeenCalled();
  });

  it('answers another parent’s consenting child exactly like an unknown id', async () => {
    const theirs = finished({
      id: 'theirs',
      ownerId: PARENT_B.id,
      controls: { ...finished().controls, voiceEnabled: true },
      voiceNotice: { confirmedAt, version: VOICE_NOTICE_VERSION },
    });
    const { speech, record } = wire(theirs);

    const foreign = (await record('theirs'))._unsafeUnwrapErr();
    const unknown = (await record('nobody'))._unsafeUnwrapErr();

    expect(foreign).toEqual(unknown);
    expect(foreign).toMatchObject({ code: 'voice.child_profile_not_found' });
    expect(speech.transcribe).not.toHaveBeenCalled();
  });
});

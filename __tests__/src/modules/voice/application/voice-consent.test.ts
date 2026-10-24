import { describe, expect, it, vi } from 'vitest';

import { GrantVoiceConsent } from '@modules/voice/application/commands/grant-voice-consent';
import { RevokeVoiceConsent } from '@modules/voice/application/commands/revoke-voice-consent';
import { GetVoiceConsent } from '@modules/voice/application/queries/get-voice-consent';

import { NOW, denying, fakeConsents, unreadableConsents, voiceDependencies } from '../fakes';

const holder = { tenantId: 'default', parentId: 'parent-1' };
const EARLIER = new Date('2026-10-01T08:00:00.000Z');

describe('voice consent', () => {
  it('grants consent for the signed-in parent and audits it', async () => {
    const consents = fakeConsents(null);
    const audit = { record: vi.fn() };
    const deps = voiceDependencies({ consents, audit });

    const result = await new GrantVoiceConsent(deps).execute();

    expect(result._unsafeUnwrap()).toEqual({
      given: true,
      grantedAt: NOW.toISOString(),
      revokedAt: null,
    });
    expect(consents.grant).toHaveBeenCalledWith(holder, NOW);
    expect(audit.record).toHaveBeenCalledWith({ type: 'voice.consent_granted', ...holder });
  });

  it('revokes consent, keeping when it was granted', async () => {
    const audit = { record: vi.fn() };
    const deps = voiceDependencies({
      consents: fakeConsents({ grantedAt: EARLIER, revokedAt: null }),
      audit,
    });

    const result = await new RevokeVoiceConsent(deps).execute();

    expect(result._unsafeUnwrap()).toEqual({
      given: false,
      grantedAt: EARLIER.toISOString(),
      revokedAt: NOW.toISOString(),
    });
    expect(audit.record).toHaveBeenCalledWith({ type: 'voice.consent_revoked', ...holder });
  });

  it('reports no consent before it was ever granted', async () => {
    const deps = voiceDependencies({ consents: fakeConsents(null) });

    const result = await new GetVoiceConsent(deps).execute();

    expect(result._unsafeUnwrap()).toEqual({ given: false, grantedAt: null, revokedAt: null });
  });

  it('requires the voice.use permission for every consent operation', async () => {
    const consents = fakeConsents(null);
    const deps = voiceDependencies({ authorization: denying(), consents });

    for (const operation of [
      new GrantVoiceConsent(deps),
      new RevokeVoiceConsent(deps),
      new GetVoiceConsent(deps),
    ]) {
      expect((await operation.execute())._unsafeUnwrapErr().kind).toBe('forbidden');
    }
    expect(consents.grant).not.toHaveBeenCalled();
    expect(consents.revoke).not.toHaveBeenCalled();
    expect(consents.find).not.toHaveBeenCalled();
  });

  it('passes a store failure on and audits nothing', async () => {
    const audit = { record: vi.fn() };
    const deps = voiceDependencies({ consents: unreadableConsents(), audit });

    const result = await new GrantVoiceConsent(deps).execute();

    expect(result._unsafeUnwrapErr().kind).toBe('infrastructure');
    expect(audit.record).not.toHaveBeenCalled();
  });
});

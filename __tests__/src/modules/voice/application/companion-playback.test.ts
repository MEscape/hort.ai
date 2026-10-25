import { describe, expect, it } from 'vitest';

import { SynthesizeSpeech } from '@modules/voice/application/queries/synthesize-speech';
import { hmacSpokenTextTickets } from '@modules/voice/infrastructure/tickets/hmac-spoken-text-tickets';

import { okAsync } from '@lib/result';

import { voiceDependencies } from '../fakes';

function setup(consent = true) {
  const tickets = hmacSpokenTextTickets({
    secret: 'test-secret',
    clock: { now: () => new Date('2026-10-25') },
  });
  const deps = voiceDependencies({ tickets, consent: { voiceConsentOf: () => okAsync(consent) } });
  const ticket = tickets.issue('Try a small step.', {
    tenantId: 'default' as never,
    actorId: 'parent-1' as never,
    childProfileId: 'child-1' as never,
    speakerId: 'max' as never,
  });
  return { deps, ticket, query: new SynthesizeSpeech(deps) };
}

describe('companion playback consent and binding', () => {
  it('plays a child-bound ticket only with current consent', async () => {
    const { deps, query, ticket } = setup();
    expect(
      (
        await query.execute({
          childProfileId: 'child-1',
          speakerId: 'max',
          source: { kind: 'ticket', ticket },
        })
      ).isOk(),
    ).toBe(true);
    expect(deps.speech?.synthesize).toHaveBeenCalledOnce();
  });
  it('refuses playback after consent was withdrawn, before the provider', async () => {
    const { deps, query, ticket } = setup(false);
    expect(
      (
        await query.execute({
          childProfileId: 'child-1',
          speakerId: 'max',
          source: { kind: 'ticket', ticket },
        })
      )._unsafeUnwrapErr().code,
    ).toBe('voice.consent_required');
    expect(deps.speech?.synthesize).not.toHaveBeenCalled();
  });
  it.each([undefined, 'child-2'])(
    'cannot drop or replace the bound child (%s)',
    async (childProfileId) => {
      const { deps, query, ticket } = setup();
      const result = await query.execute({
        ...(childProfileId === undefined ? {} : { childProfileId }),
        speakerId: 'max',
        source: { kind: 'ticket', ticket },
      });
      expect(result._unsafeUnwrapErr().code).toBe('voice.validation_failed');
      expect(deps.speech?.synthesize).not.toHaveBeenCalled();
    },
  );
  it('binds the voice too', () => {
    const { deps, ticket } = setup();
    expect(
      deps.tickets.redeem(ticket, {
        tenantId: 'default' as never,
        actorId: 'parent-1' as never,
        childProfileId: 'child-1' as never,
        speakerId: 'lili' as never,
      }),
    ).toBe(null);
  });
});

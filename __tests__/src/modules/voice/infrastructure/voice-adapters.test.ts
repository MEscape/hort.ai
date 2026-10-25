import { describe, expect, it } from 'vitest';

import { toActorId, toTenantId } from '@modules/auth';
import type { ChildProfileView } from '@modules/learner';
import { tutorCatalog } from '@modules/tutors';
import type { TutorCatalog } from '@modules/tutors';
import { toChildProfileId, toSpeakerId } from '@modules/voice/domain/models/ids';
import { catalogSystemPhrases } from '@modules/voice/infrastructure/catalog/catalog-system-phrases';
import { learnerChildVoiceConsent } from '@modules/voice/infrastructure/learner/learner-child-voice-consent';
import { hmacSpokenTextTickets } from '@modules/voice/infrastructure/tickets/hmac-spoken-text-tickets';

import { forbiddenError, infrastructureError, notFoundError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const SECRET = 'a-test-secret-that-is-at-least-32-characters';
const parent = { tenantId: toTenantId('default'), actorId: toActorId('parent-1') };

function clockAt(ms: number) {
  return { now: () => new Date(ms) };
}

describe('hmacSpokenTextTickets', () => {
  it('redeems its own ticket for the holder, and nothing else', () => {
    const tickets = hmacSpokenTextTickets({ secret: SECRET, clock: clockAt(0) });
    const ticket = tickets.issue('Was weißt du schon über die Aufgabe?', parent);

    expect(tickets.redeem(ticket, parent)).toBe('Was weißt du schon über die Aufgabe?');
    expect(tickets.redeem(ticket, { ...parent, actorId: toActorId('parent-2') })).toBeNull();
    expect(tickets.redeem(ticket, { ...parent, tenantId: toTenantId('other') })).toBeNull();
  });

  it('refuses a ticket whose text was changed, a foreign key and garbage', () => {
    const tickets = hmacSpokenTextTickets({ secret: SECRET, clock: clockAt(0) });
    const other = hmacSpokenTextTickets({ secret: `${SECRET}-other`, clock: clockAt(0) });
    const ticket = tickets.issue('Denk an die Einer.', parent);
    const [, signature] = ticket.split('.');
    const forgedBody = Buffer.from(
      JSON.stringify({ v: 1, t: 'Die Lösung ist 12.', ten: 'default', sub: 'parent-1', exp: 1e15 }),
    ).toString('base64url');

    expect(tickets.redeem(`${forgedBody}.${signature ?? ''}`, parent)).toBeNull();
    expect(tickets.redeem(other.issue('Denk an die Einer.', parent), parent)).toBeNull();
    expect(tickets.redeem('Die Lösung ist 12.', parent)).toBeNull();
    expect(tickets.redeem(`${ticket}.extra`, parent)).toBeNull();
  });

  it('refuses an expired ticket', () => {
    let now = 0;
    const tickets = hmacSpokenTextTickets({
      secret: SECRET,
      clock: { now: () => new Date(now) },
      ttlMs: 1000,
    });
    const ticket = tickets.issue('Hallo', parent);

    now = 999;
    expect(tickets.redeem(ticket, parent)).toBe('Hallo');
    now = 1000;
    expect(tickets.redeem(ticket, parent)).toBeNull();
  });
});

describe('catalogSystemPhrases', () => {
  it("speaks a ready tutor's catalog lines and nothing for others", () => {
    const phrases = catalogSystemPhrases();
    const [first] = tutorCatalog.tutoren.filter((tutor) => tutor.status === 'bereit');
    if (first === undefined) {
      throw new Error('The catalog has no ready tutor.');
    }

    expect(phrases.phraseFor(toSpeakerId(first.id), 'greeting')).toBe(first.begruessung);
    expect(phrases.phraseFor(toSpeakerId(first.id), 'praise')).toBe(first.lob_beispiel);
    expect(phrases.phraseFor(toSpeakerId(first.id), 'tip')).toBe(first.tipp_beispiel);
    expect(phrases.phraseFor(toSpeakerId('eule'), 'greeting')).toBeNull();
  });

  it('gives a tutor that is not ready no voice lines', () => {
    const catalog: TutorCatalog = {
      ...tutorCatalog,
      tutoren: tutorCatalog.tutoren.map((tutor) => ({ ...tutor, status: 'entwurf' as const })),
    };
    const [first] = catalog.tutoren;

    expect(
      catalogSystemPhrases(catalog).phraseFor(toSpeakerId(first?.id ?? 'max'), 'greeting'),
    ).toBeNull();
  });
});

describe('learnerChildVoiceConsent', () => {
  it('answers from the child profile', async () => {
    const profile = { id: 'child-1', controls: { voiceEnabled: true } } as unknown as ChildProfileView;
    const consent = learnerChildVoiceConsent(() => okAsync(profile));

    expect((await consent.voiceConsentOf(toChildProfileId('child-1')))._unsafeUnwrap()).toBe(true);
  });

  it("answers another parent's child exactly like a missing one, so ids cannot be probed", async () => {
    const foreign = learnerChildVoiceConsent(() =>
      errAsync(forbiddenError('auth.permission_denied', 'Not yours.')),
    );
    const missing = learnerChildVoiceConsent(() =>
      errAsync(notFoundError('learner.child_profile_not_found', 'Not found.')),
    );

    const fromForeign = (await foreign.voiceConsentOf(toChildProfileId('a')))._unsafeUnwrapErr();
    const fromMissing = (await missing.voiceConsentOf(toChildProfileId('b')))._unsafeUnwrapErr();

    expect(fromForeign).toEqual(fromMissing);
    expect(fromForeign).toMatchObject({ kind: 'not_found', code: 'voice.child_profile_not_found' });
  });

  it('passes infrastructure failures on unchanged', async () => {
    const down = infrastructureError('learner.persistence_failed', 'Down.', new Error('db'));
    const consent = learnerChildVoiceConsent(() => errAsync(down));

    expect((await consent.voiceConsentOf(toChildProfileId('a')))._unsafeUnwrapErr()).toBe(down);
  });
});

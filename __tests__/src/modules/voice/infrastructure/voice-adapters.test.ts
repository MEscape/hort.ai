import { describe, expect, it } from 'vitest';

import { tutorCatalog } from '@modules/tutors';
import type { TutorCatalog } from '@modules/tutors';
import { toSpeakerId } from '@modules/voice/domain/models/ids';
import { catalogSystemPhrases } from '@modules/voice/infrastructure/catalog/catalog-system-phrases';
import { hmacSpokenTextTickets } from '@modules/voice/infrastructure/tickets/hmac-spoken-text-tickets';
import { learnerChildVoiceConsent } from '@modules/voice/infrastructure/learner/learner-child-voice-consent';

import type { ChildProfileView } from '@modules/learner';

import { notFoundError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';

const SECRET = 'a-test-secret-that-is-at-least-32-characters';
const parent = { tenantId: 'default', actorId: 'parent-1' };

function clockAt(ms: number) {
  return { now: () => new Date(ms) };
}

describe('hmacSpokenTextTickets', () => {
  it('redeems its own ticket for the holder, and nothing else', () => {
    const tickets = hmacSpokenTextTickets({ secret: SECRET, clock: clockAt(0) });
    const ticket = tickets.issue('Was weißt du schon über die Aufgabe?', parent);

    expect(tickets.redeem(ticket, parent)).toBe('Was weißt du schon über die Aufgabe?');
    expect(tickets.redeem(ticket, { ...parent, actorId: 'parent-2' })).toBeNull();
    expect(tickets.redeem(ticket, { ...parent, tenantId: 'other' })).toBeNull();
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
  it("answers from the child profile and passes the learner module's refusal on", async () => {
    const profile = { id: 'child-1', voiceConsent: true } as unknown as ChildProfileView;
    const missing = notFoundError('learner.child_profile_not_found', 'Not found.');
    const consent = learnerChildVoiceConsent((id) =>
      id === 'child-1' ? okAsync(profile) : errAsync(missing),
    );

    expect((await consent.voiceConsentOf('child-1'))._unsafeUnwrap()).toBe(true);
    expect((await consent.voiceConsentOf('child-of-another-parent'))._unsafeUnwrapErr()).toBe(
      missing,
    );
  });
});

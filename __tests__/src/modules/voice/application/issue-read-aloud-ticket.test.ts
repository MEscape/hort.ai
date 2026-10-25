import { describe, expect, it, vi } from 'vitest';

import { SPEECH_LIMITS } from '@modules/voice/application/contracts/voice-constraints';
import { IssueReadAloudTicket } from '@modules/voice/application/queries/issue-read-aloud-ticket';
import type { IssueReadAloudTicketDependencies } from '@modules/voice/application/voice-dependencies';
import type { CompanionMessages } from '@modules/voice/domain/ports/companion-messages.port';

import { errAsync, okAsync } from '@lib/result';

import { allowing, denying } from '../fakes';

function dependencies(overrides: Partial<IssueReadAloudTicketDependencies> = {}) {
  const tickets = { issue: vi.fn((text: string) => `ticket:${text}`), redeem: vi.fn(() => null) };
  const deps: IssueReadAloudTicketDependencies = {
    authorization: allowing(),
    tickets,
    voices: { voiceFor: (id) => (id === 'tutor-1' ? 'voice-1' : null) },
    messages: {
      companionOf: vi.fn(() => okAsync({ voiceConsent: true, tutorId: 'tutor-1' })),
      textOf: vi.fn(() => okAsync('  Hallo, Kind!  ')),
    },
    ...overrides,
  };
  return deps;
}

const hint = { kind: 'hint', index: 0 } as const;
const wording = (key: string) => `worded:${key}`;

describe('IssueReadAloudTicket', () => {
  it('issues a ticket bound to the signed-in parent and the child’s available tutor voice', async () => {
    const deps = dependencies();

    const result = await new IssueReadAloudTicket(deps).execute({
      childProfileId: 'child-1',
      message: hint,
      wording,
    });

    expect(result._unsafeUnwrap()).toEqual({ ticket: 'ticket:Hallo, Kind!', speakerId: 'tutor-1' });
    expect(deps.tickets.issue).toHaveBeenCalledWith('Hallo, Kind!', {
      tenantId: 'default',
      actorId: 'parent-1',
      childProfileId: 'child-1',
      speakerId: 'tutor-1',
    });
  });

  it.each([
    ['no selected tutor', null],
    ['tutor without a voice', 'unknown-tutor'],
  ])('uses the narrator for %s', async (_label, tutorId) => {
    const deps = dependencies({
      messages: {
        companionOf: vi.fn(() => okAsync({ voiceConsent: true, tutorId })),
        textOf: vi.fn(() => okAsync('Hallo')),
      },
    });

    const result = await new IssueReadAloudTicket(deps).execute({
      childProfileId: 'child-1',
      message: hint,
      wording,
    });

    expect(result._unsafeUnwrap().speakerId).toBe('eule');
  });

  it('requires consent before looking up message text or issuing a ticket', async () => {
    const messages = {
      companionOf: vi.fn(() => okAsync({ voiceConsent: false, tutorId: 'tutor-1' })),
      textOf: vi.fn(() => okAsync('Hallo')),
    } as unknown as CompanionMessages;
    const deps = dependencies({ messages });

    const error = (
      await new IssueReadAloudTicket(deps).execute({
        childProfileId: 'child-1',
        message: hint,
        wording,
      })
    )._unsafeUnwrapErr();

    expect(error.code).toBe('voice.consent_required');
    expect(messages.textOf).not.toHaveBeenCalled();
    expect(deps.tickets.issue).not.toHaveBeenCalled();
  });

  it('requires voice.use authorization', async () => {
    const result = await new IssueReadAloudTicket(
      dependencies({ authorization: denying() }),
    ).execute({
      childProfileId: 'child-1',
      message: hint,
      wording,
    });

    expect(result._unsafeUnwrapErr().code).toBe('auth.permission_denied');
  });

  it('rejects an empty child profile id', async () => {
    const deps = dependencies();

    const error = (
      await new IssueReadAloudTicket(deps).execute({ childProfileId: '', message: hint, wording })
    )._unsafeUnwrapErr();

    expect(error.kind).toBe('validation');
    expect(deps.messages.companionOf).not.toHaveBeenCalled();
  });

  it('returns message-not-found when the named message has no text', async () => {
    const deps = dependencies({
      messages: {
        companionOf: vi.fn(() => okAsync({ voiceConsent: true, tutorId: null })),
        textOf: vi.fn(() => okAsync(null)),
      },
    });

    const error = (
      await new IssueReadAloudTicket(deps).execute({
        childProfileId: 'child-1',
        message: hint,
        wording,
      })
    )._unsafeUnwrapErr();

    expect(error.code).toBe('voice.message_not_found');
    expect(deps.tickets.issue).not.toHaveBeenCalled();
  });

  it('rejects message text longer than the speech limit', async () => {
    const deps = dependencies({
      messages: {
        companionOf: vi.fn(() => okAsync({ voiceConsent: true, tutorId: null })),
        textOf: vi.fn(() => okAsync('a'.repeat(SPEECH_LIMITS.maxTextLength + 1))),
      },
    });

    const error = (
      await new IssueReadAloudTicket(deps).execute({
        childProfileId: 'child-1',
        message: hint,
        wording,
      })
    )._unsafeUnwrapErr();

    expect(error).toMatchObject({ fieldErrors: { text: ['voice.validation.text_too_long'] } });
    expect(deps.tickets.issue).not.toHaveBeenCalled();
  });

  it('propagates a companion lookup error', async () => {
    const failure = new Error('profile lookup failed');
    const deps = dependencies({
      messages: {
        companionOf: vi.fn(() => errAsync(failure as never)),
        textOf: vi.fn(() => okAsync('unused')),
      },
    });

    const result = await new IssueReadAloudTicket(deps).execute({
      childProfileId: 'child-1',
      message: hint,
      wording,
    });

    expect(result._unsafeUnwrapErr()).toBe(failure);
    expect(deps.tickets.issue).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';

import type { HelpSessionView } from '@modules/guidance';
import type {
  CompanionMessageRef,
  PredefinedWording,
} from '@modules/voice/application/contracts/voice-constraints';
import { helpSessionCompanionMessages } from '@modules/voice/infrastructure/guidance/help-session-companion-messages';

import { forbiddenError, infrastructureError, notFoundError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

function session(overrides: Partial<HelpSessionView> = {}): HelpSessionView {
  return {
    sessionId: 'session-1',
    task: 'task',
    subject: 'math',
    status: 'in_progress',
    hintLevel: null,
    hints: [],
    answerChecks: [],
    openQuestion: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as HelpSessionView;
}

function setup({
  profileResult = okAsync({ voiceConsent: true, tutorId: 'tutor-1' }),
  sessionResult = okAsync(session()),
  translate = vi.fn((key: string) => `translated:${key}`),
}: {
  profileResult?: AppResultAsync<unknown>;
  sessionResult?: AppResultAsync<unknown>;
  translate?: PredefinedWording;
} = {}) {
  const getChildProfile = vi.fn(() => profileResult);
  const getOpenHelpSession = vi.fn(() => sessionResult);
  const messages = helpSessionCompanionMessages({
    getChildProfile: getChildProfile as never,
    getOpenHelpSession: getOpenHelpSession as never,
  });
  const wrapped = {
    companionOf: messages.companionOf,
    textOf: (id: never, message: CompanionMessageRef) => messages.textOf(id, message, translate),
  };
  return { messages: wrapped, getChildProfile, getOpenHelpSession, translate };
}

describe('helpSessionCompanionMessages', () => {
  it('returns the stored text for a generated hint', async () => {
    const { messages } = setup({
      sessionResult: okAsync(
        session({ hints: [{ kind: 'generated', level: 'understand_task', text: 'Stored hint' }] }),
      ),
    });

    expect(
      (await messages.textOf('child-1' as never, { kind: 'hint', index: 0 }))._unsafeUnwrap(),
    ).toBe('Stored hint');
  });

  it('translates a fallback hint using its level key', async () => {
    const translate = vi.fn((key: string) => `translated:${key}`);
    const { messages } = setup({
      sessionResult: okAsync(
        session({
          hints: [{ kind: 'fallback', level: 'next_step', reason: 'provider_unavailable' }],
        }),
      ),
      translate,
    });

    expect(
      (await messages.textOf('child-1' as never, { kind: 'hint', index: 0 }))._unsafeUnwrap(),
    ).toBe('translated:hint.fallback.next_step');
    expect(translate).toHaveBeenCalledWith('hint.fallback.next_step');
  });

  it('returns null for a hint index outside the open session', async () => {
    const { messages } = setup({ sessionResult: okAsync(session({ hints: [] })) });

    expect(
      (await messages.textOf('child-1' as never, { kind: 'hint', index: 8 }))._unsafeUnwrap(),
    ).toBe(null);
  });

  it('returns null for hint and question when there is no open session', async () => {
    const { messages } = setup({ sessionResult: okAsync(null) });

    expect(
      (await messages.textOf('child-1' as never, { kind: 'hint', index: 0 }))._unsafeUnwrap(),
    ).toBe(null);
    expect((await messages.textOf('child-1' as never, { kind: 'question' }))._unsafeUnwrap()).toBe(
      null,
    );
  });

  it('returns the generated open-question text', async () => {
    const { messages } = setup({
      sessionResult: okAsync(
        session({ openQuestion: { kind: 'generated', text: 'Your turn?' } as never }),
      ),
    });

    expect((await messages.textOf('child-1' as never, { kind: 'question' }))._unsafeUnwrap()).toBe(
      'Your turn?',
    );
  });

  it('translates a predefined open question from the guidance catalog', async () => {
    const translate = vi.fn((key: string) => `translated:${key}`);
    const { messages } = setup({
      sessionResult: okAsync(session({ openQuestion: { kind: 'predefined' } as never })),
      translate,
    });

    expect((await messages.textOf('child-1' as never, { kind: 'question' }))._unsafeUnwrap()).toBe(
      'translated:feedback.fallback.comprehension_question',
    );
    expect(translate).toHaveBeenCalledWith('feedback.fallback.comprehension_question');
  });

  it.each([
    ['praise', 'feedback.fallback.praise'],
    ['not_yet', 'feedback.fallback.answer_assessment.not_yet'],
  ] as const)('translates feedback %s without querying the open session', async (feedback, key) => {
    const translate = vi.fn((translationKey: string) => `translated:${translationKey}`);
    const { messages, getOpenHelpSession } = setup({ translate });

    expect(
      (await messages.textOf('child-1' as never, { kind: 'feedback', feedback }))._unsafeUnwrap(),
    ).toBe(`translated:${key}`);
    expect(translate).toHaveBeenCalledWith(key);
    expect(getOpenHelpSession).not.toHaveBeenCalled();
  });

  it('maps child profile and consent and obscures forbidden or missing learner profiles', async () => {
    const { messages } = setup({
      profileResult: okAsync({ voiceConsent: false, tutorId: null }),
    });

    expect((await messages.companionOf('child-1' as never))._unsafeUnwrap()).toEqual({
      voiceConsent: false,
      tutorId: null,
    });

    for (const failure of [
      forbiddenError('auth.permission_denied', 'forbidden'),
      notFoundError('learner.not_found', 'missing'),
    ]) {
      const result = setup({ profileResult: errAsync(failure) });
      expect((await result.messages.companionOf('child-1' as never))._unsafeUnwrapErr().code).toBe(
        'voice.child_profile_not_found',
      );
    }
  });

  it('passes learner errors of other kinds through unchanged', async () => {
    const failure = infrastructureError('learner.unavailable', 'unavailable');
    const { messages } = setup({ profileResult: errAsync(failure) });

    expect((await messages.companionOf('child-1' as never))._unsafeUnwrapErr()).toBe(failure);
  });
});

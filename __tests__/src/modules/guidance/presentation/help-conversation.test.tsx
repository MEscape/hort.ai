import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HelpSessionDto } from '@modules/guidance/client';
import { HelpConversation } from '@modules/guidance/client';
import type { TutorOption } from '@modules/learner/client';

const actions = vi.hoisted(() => ({
  requestHint: vi.fn(),
  checkAnswer: vi.fn(),
  reply: vi.fn(),
}));

vi.mock('@i18n/client', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@i18n', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@components/brand/character', () => ({ Character: () => <span aria-hidden="true" /> }));
vi.mock('@modules/guidance/presentation/actions/request-hint-action', () => ({
  requestHintAction: actions.requestHint,
}));
vi.mock('@modules/guidance/presentation/actions/check-answer-action', () => ({
  checkAnswerAction: actions.checkAnswer,
}));
vi.mock('@modules/guidance/presentation/actions/reply-to-comprehension-question-action', () => ({
  replyToComprehensionQuestionAction: actions.reply,
}));
vi.mock('@modules/guidance/presentation/actions/start-help-session-action', () => ({
  startHelpSessionAction: vi.fn(),
}));

const companion = {
  id: 'lili',
  name: 'Lili',
  imageUrl: '',
  imageOpenUrl: '',
  introUrl: '',
  voice: '',
  description: '',
  greeting: '',
  animal: '',
  traits: [],
  topics: [],
} satisfies TutorOption;

function session(overrides: Partial<HelpSessionDto> = {}): HelpSessionDto {
  return {
    sessionId: 'session-1',
    task: 'What is 2 + 3?',
    status: 'working',
    hints: [{ kind: 'fallback', level: 'understand_task', reason: 'provider_unavailable' }],
    answerChecks: 0,
    openQuestion: null,
    ...overrides,
  };
}

const renderScreen = (initial: HelpSessionDto) =>
  render(<HelpConversation childProfileId="child-1" initial={initial} companion={companion} />);

describe('HelpConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('continues a stored session: task, hints and the working controls', () => {
    renderScreen(session());
    expect(screen.getByText('What is 2 + 3?')).toBeVisible();
    expect(screen.getByText('hint.fallback.understand_task')).toBeVisible();
    expect(screen.getByText('conversation.hint')).toBeVisible();
    expect(screen.getByText('conversation.checkAnswer')).toBeVisible();
    expect(actions.requestHint).not.toHaveBeenCalled();
  });

  it('opens a new session with the thinking prompt under a fixed request id', async () => {
    actions.requestHint.mockResolvedValue({
      ok: true,
      data: { hint: { kind: 'generated', level: 'understand_task', text: 'Was ist gesucht?' } },
    });
    await act(async () => {
      renderScreen(session({ hints: [] }));
    });
    expect(actions.requestHint).toHaveBeenCalledWith({
      childProfileId: 'child-1',
      sessionId: 'session-1',
      requestId: 'opening',
    });
    expect(screen.getByText('Was ist gesucht?')).toBeVisible();
  });

  it('reuses the request id when the child retries a failed hint', async () => {
    actions.requestHint.mockResolvedValueOnce({ ok: false, error: { code: 'x' } });
    actions.requestHint.mockResolvedValueOnce({
      ok: true,
      data: {
        hint: {
          kind: 'fallback',
          level: 'activate_prior_knowledge',
          reason: 'provider_unavailable',
        },
      },
    });
    renderScreen(session());
    await act(async () => {
      fireEvent.click(screen.getByText('conversation.hint'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('conversation.retry'));
    });
    const [first, second] = actions.requestHint.mock.calls.map(
      ([input]) => (input as { requestId: string }).requestId,
    );
    expect(second).toBe(first);
    expect(screen.getByText('hint.fallback.activate_prior_knowledge')).toBeVisible();
  });

  it('praises a right answer, asks the question and finishes after the reply', async () => {
    actions.checkAnswer.mockResolvedValue({
      ok: true,
      data: {
        result: 'correct',
        praise: { kind: 'predefined', feedback: 'praise', reason: null },
        question: { kind: 'generated', feedback: 'comprehension_question', text: 'Warum plus?' },
      },
    });
    actions.reply.mockResolvedValue({
      ok: true,
      data: { sessionId: 'session-1', status: 'understood' },
    });
    renderScreen(session());
    fireEvent.change(screen.getByLabelText('conversation.answerLabel'), {
      target: { value: '5' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('conversation.checkAnswer'));
    });
    expect(screen.getByText('feedback.fallback.praise')).toBeVisible();
    expect(screen.getByText('Warum plus?')).toBeVisible();

    fireEvent.change(screen.getByLabelText('conversation.replyLabel'), {
      target: { value: 'Weil es mehr wird.' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('conversation.sendReply'));
    });
    expect(screen.getByText('conversation.doneTitle')).toBeVisible();
  });

  it('encourages after a not-yet answer and waits for the child to ask for the next hint', async () => {
    actions.checkAnswer.mockResolvedValue({
      ok: true,
      data: {
        result: 'not_yet',
        next: 'hint_ladder',
        message: { kind: 'predefined', feedback: 'answer_assessment', reason: null },
      },
    });
    renderScreen(session());
    fireEvent.change(screen.getByLabelText('conversation.answerLabel'), {
      target: { value: '6' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('conversation.checkAnswer'));
    });
    expect(screen.getByText('feedback.fallback.answer_assessment.not_yet')).toBeVisible();
    expect(actions.requestHint).not.toHaveBeenCalled();
  });

  it('asks for text before sending an empty answer', () => {
    renderScreen(session());
    fireEvent.click(screen.getByText('conversation.checkAnswer'));
    expect(screen.getByRole('alert')).toHaveTextContent('conversation.empty');
    expect(actions.checkAnswer).not.toHaveBeenCalled();
  });

  it('shows the comprehension question of a reloaded session', () => {
    renderScreen(
      session({
        status: 'awaiting_comprehension_reply',
        openQuestion: { kind: 'predefined', feedback: 'comprehension_question', reason: null },
      }),
    );
    expect(screen.getByText('feedback.fallback.comprehension_question')).toBeVisible();
    expect(screen.getByText('conversation.sendReply')).toBeVisible();
  });
});

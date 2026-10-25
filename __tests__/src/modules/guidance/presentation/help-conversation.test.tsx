import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
vi.mock('@modules/guidance/presentation/actions/reply-comprehension-action', () => ({
  replyComprehensionAction: actions.reply,
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
    assignmentId: null,
    task: 'What is 2 + 3?',
    subject: 'math',
    status: 'working',
    hintLevel: 'understand_task',
    hints: [{ kind: 'fallback', level: 'understand_task', reason: 'provider_unavailable' }],
    answerChecks: [],
    openQuestion: null,
    opening: null,
    updatedAt: '2026-10-25T08:00:00.000Z',
    ...overrides,
  };
}

const renderScreen = (initial: HelpSessionDto) =>
  render(<HelpConversation childProfileId="child-1" initial={initial} companion={companion} />);

/** The side panel's transcript: the conversation as text (the stage shows the latest line too). */
const transcript = () => within(screen.getByRole('complementary'));

describe('HelpConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the stored clarification without calling the hint model', () => {
    renderScreen(session({ hints: [], opening: { kind: 'clarify' } }));
    expect(screen.getByText('opening.clarify')).toBeVisible();
    expect(screen.queryByText('conversation.hint')).not.toBeInTheDocument();
    expect(actions.requestHint).not.toHaveBeenCalled();
  });

  it('continues a stored session: task, hints and the working controls', () => {
    renderScreen(session());
    expect(screen.getByText('What is 2 + 3?')).toBeVisible();
    expect(transcript().getByText('hint.fallback.understand_task')).toBeVisible();
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
    expect(transcript().getByText('Was ist gesucht?')).toBeVisible();
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
    expect(transcript().getByText('hint.fallback.activate_prior_knowledge')).toBeVisible();
  });

  it('keeps the request id for a retried answer, but makes a new one once the answer changes', async () => {
    actions.checkAnswer.mockResolvedValue({ ok: false, error: { code: 'x' } });
    renderScreen(session());
    const answer = (value: string) => {
      fireEvent.change(screen.getByLabelText('conversation.answerLabel'), { target: { value } });
    };
    answer('5');
    await act(async () => {
      fireEvent.click(screen.getByText('conversation.checkAnswer'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText('conversation.retry'));
    });
    answer('6');
    await act(async () => {
      fireEvent.click(screen.getByText('conversation.checkAnswer'));
    });
    const [first, retried, changed] = actions.checkAnswer.mock.calls.map(
      ([input]) => (input as { requestId: string }).requestId,
    );
    expect(retried).toBe(first);
    expect(changed).not.toBe(first);
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
    expect(transcript().getByText('feedback.fallback.praise')).toBeVisible();
    expect(transcript().getByText('Warum plus?')).toBeVisible();

    fireEvent.change(screen.getByLabelText('conversation.replyLabel'), {
      target: { value: 'Weil es mehr wird.' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('conversation.sendReply'));
    });
    expect(screen.getByText('conversation.doneBody')).toBeVisible();
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
    expect(transcript().getByText('feedback.fallback.answer_assessment.not_yet')).toBeVisible();
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
    expect(transcript().getByText('feedback.fallback.comprehension_question')).toBeVisible();
    expect(screen.getByText('conversation.sendReply')).toBeVisible();
  });
});

describe('HelpConversation errors that a retry cannot fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const failHint = async (error: { code: string; retryAfterSeconds?: number }) => {
    actions.requestHint.mockResolvedValue({ ok: false, error });
    renderScreen(session());
    await act(async () => {
      fireEvent.click(screen.getByText('conversation.hint'));
    });
  };

  it.each([
    ['guidance.session_not_found', 'errors.sessionNotFound'],
    ['guidance.no_open_question', 'errors.noOpenQuestion'],
    ['guidance.no_hint_for_opening', 'errors.noHintForOpening'],
  ])('shows %s with a way back instead of a retry', async (code, message) => {
    await failHint({ code });
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText('conversation.retry')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'conversation.home' })).toHaveAttribute(
      'href',
      '/home',
    );
  });

  it('shows a closed day as a calm status with a way home', async () => {
    await failHint({ code: 'guidance.learning_paused' });
    expect(screen.getByRole('status')).toHaveTextContent('errors.learningPaused');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('conversation.retry')).not.toBeInTheDocument();
  });

  it('shows the trusted-adult notice for distress, without a retry', async () => {
    actions.checkAnswer.mockResolvedValue({
      ok: false,
      error: { code: 'guidance.child_distress' },
    });
    renderScreen(session());
    fireEvent.change(screen.getByLabelText('conversation.answerLabel'), {
      target: { value: 'something' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('conversation.checkAnswer'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('errors.childDistress');
    expect(screen.queryByText('conversation.retry')).not.toBeInTheDocument();
  });

  it('keeps Retry disabled while the budget pauses, then allows it again', async () => {
    vi.useFakeTimers();
    try {
      await failHint({ code: 'guidance.rate_limited', retryAfterSeconds: 30 });
      expect(screen.getByRole('alert')).toHaveTextContent('errors.rateLimited');
      expect(screen.getByRole('button', { name: 'conversation.retry' })).toBeDisabled();
      act(() => {
        vi.advanceTimersByTime(29_000);
      });
      expect(screen.getByRole('button', { name: 'conversation.retry' })).toBeDisabled();
      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(screen.getByRole('button', { name: 'conversation.retry' })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });
});

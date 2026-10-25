import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toLessonView } from '@modules/lesson/application/lesson-view-mappers';
import { COMPARE_FRACTIONS_LESSON } from '@modules/lesson/domain/lessons/compare-fractions';
import { checkSceneAnswerAction } from '@modules/lesson/presentation/actions/check-scene-answer-action';
import { LessonPlayer } from '@modules/lesson/presentation/components/lesson-player';
import { toLessonDto } from '@modules/lesson/presentation/dto/lesson-dto';
import en from '@modules/lesson/presentation/i18n/en.json';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import app from '@/i18n/messages/en.json';

vi.mock('@modules/lesson/presentation/actions/check-scene-answer-action', () => ({
  checkSceneAnswerAction: vi.fn(),
}));

const action = vi.mocked(checkSceneAnswerAction);
const LESSON = toLessonDto(toLessonView(COMPARE_FRACTIONS_LESSON));
const TEXT = en.lesson.lessons['compare-fractions'];

const COMPANION = {
  id: 'max',
  name: 'Max',
  animal: 'dog',
  description: '',
  traits: [],
  topics: [],
  greeting: '',
  voice: '',
  imageUrl: 'https://storage.test/tutors/max/mund-zu.svg',
  imageOpenUrl: 'https://storage.test/tutors/max/mund-auf.svg',
  introUrl: '',
};

const CORRECT = { line: 'correct', reaction: 'celebrate', mascot: 'cheer' } as const;
const NOT_YET = { line: 'notYet', reaction: 'wobble', mascot: 'oops' } as const;
const HINT = { line: 'hint', reaction: 'line-up', mascot: 'curious' } as const;

function renderPlayer(lesson = LESSON) {
  render(
    <I18nClientProvider
      locale="en"
      messages={{ app, ...en }}
      timeZone="Europe/Berlin"
      isDevelopment
    >
      <LessonPlayer childProfileId="child-1" lesson={lesson} companion={COMPANION} />
    </I18nClientProvider>,
  );
}

const upperBridge = () => screen.getByRole('button', { name: /upper bridge/i });

describe('LessonPlayer', () => {
  beforeEach(() => {
    action.mockReset();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
  });

  it('starts with the scene and one spoken-style sentence, no chat', () => {
    renderPlayer();

    expect(screen.getByText(TEXT.halfOrQuarter.narration)).toBeInTheDocument();
    expect(upperBridge()).toHaveAccessibleName('Upper bridge: 1 of 2 planks laid');
    expect(screen.getByRole('button', { name: /lower bridge: 1 of 4/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Both the same' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('sends the tap as a scene event and shows the backend feedback, then moves on', async () => {
    action.mockResolvedValue({
      ok: true,
      data: { outcome: 'correct', feedback: CORRECT, nextStepId: 'sameParts' },
    });
    renderPlayer();

    fireEvent.click(upperBridge());

    await screen.findByText(TEXT.halfOrQuarter.correct);
    expect(action).toHaveBeenCalledWith({
      childProfileId: 'child-1',
      lessonId: 'compare-fractions',
      stepId: 'halfOrQuarter',
      attempt: 1,
      answer: { kind: 'choose', choice: 'top' },
    });
    expect(upperBridge()).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText(TEXT.sameParts.narration)).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
  });

  it('stays on the step after a miss and counts the try, so the backend can send the hint', async () => {
    action
      .mockResolvedValueOnce({
        ok: true,
        data: { outcome: 'not_yet', feedback: NOT_YET, nextStepId: 'halfOrQuarter' },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { outcome: 'not_yet', feedback: HINT, nextStepId: 'halfOrQuarter' },
      });
    renderPlayer();

    fireEvent.click(screen.getByRole('button', { name: 'Both the same' }));
    await screen.findByText(TEXT.halfOrQuarter.notYet);
    fireEvent.click(screen.getByRole('button', { name: 'Both the same' }));
    await screen.findByText(TEXT.halfOrQuarter.hint);

    expect(action).toHaveBeenLastCalledWith(expect.objectContaining({ attempt: 2 }));
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(upperBridge()).toBeEnabled();
  });

  it('keeps the scene and says so calmly when the request fails', async () => {
    action.mockRejectedValue(new Error('offline'));
    renderPlayer();

    fireEvent.click(upperBridge());

    expect(await screen.findByRole('alert')).toHaveTextContent(en.lesson.errors.unexpected);
    expect(await screen.findByText(TEXT.halfOrQuarter.narration)).toBeInTheDocument();
    expect(upperBridge()).toBeEnabled();
  });

  it('builds a bridge plank by plank with toggles and sends only the count', async () => {
    const build = {
      ...LESSON,
      steps: LESSON.steps.filter(({ id }) => id === 'buildThreeQuarters'),
    };
    action.mockResolvedValue({
      ok: true,
      data: { outcome: 'correct', feedback: CORRECT, nextStepId: null },
    });
    renderPlayer(build);

    for (const number of [1, 2, 3]) {
      fireEvent.click(screen.getByRole('button', { name: `Plank ${number}` }));
    }
    expect(screen.getByRole('button', { name: 'Plank 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Plank 4' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Bridge finished' }));

    await waitFor(() => {
      expect(action).toHaveBeenCalledWith(
        expect.objectContaining({ answer: { kind: 'fill', laid: 3 } }),
      );
    });
  });

  it('opens the side panel only on request and judges written answers like taps', async () => {
    action.mockResolvedValue({
      ok: true,
      data: { outcome: 'correct', feedback: CORRECT, nextStepId: 'sameParts' },
    });
    renderPlayer();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Write' }));
    const panel = screen.getByRole('complementary', { name: 'Write with Max' });
    expect(panel).toHaveTextContent(TEXT.halfOrQuarter.narration);
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'the upper one' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(panel).toHaveTextContent(TEXT.halfOrQuarter.correct);
    });
    expect(action).toHaveBeenCalledWith(
      expect.objectContaining({ answer: { kind: 'text', message: 'the upper one' } }),
    );
    expect(panel).toHaveTextContent('the upper one');
    expect(screen.getByLabelText('Your answer')).toHaveValue('');
  });

  it('asks again for unclear text and keeps the draft when the backend refuses it', async () => {
    action
      .mockResolvedValueOnce({
        ok: true,
        data: { outcome: 'unclear', feedback: null, nextStepId: 'halfOrQuarter' },
      })
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'lesson.child_distress', message: 'The child may be in danger.' },
      });
    renderPlayer();
    fireEvent.click(screen.getByRole('button', { name: 'Write' }));
    const input = screen.getByLabelText('Your answer');

    fireEvent.change(input, { target: { value: 'hmm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findAllByText(en.lesson.stage.unclear['compare-bridges'])).not.toHaveLength(
      0,
    );

    fireEvent.change(input, { target: { value: 'my brother hits me' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(en.lesson.errors.childDistress);
    expect(input).toHaveValue('my brother hits me');
  });

  it('names the idea at the end and offers the lesson once more', async () => {
    const last = { ...LESSON, steps: LESSON.steps.slice(-1) };
    action.mockResolvedValue({
      ok: true,
      data: { outcome: 'correct', feedback: CORRECT, nextStepId: null },
    });
    renderPlayer(last);

    fireEvent.click(screen.getByRole('button', { name: 'Both the same' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));

    expect(screen.getByText(TEXT.conclusion)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Once more' }));
    expect(screen.getByText(TEXT.twoQuartersHalf.narration)).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { computeScreenTime } from '@modules/learner/application/contracts/learner-constraints';
import type {
  ParentLearningMetrics,
  ParentLearningRecords,
  ParentTaskWithAssignment,
} from '@modules/learner/application/contracts/parent-learning-views';
import { toParentTaskId } from '@modules/learner/domain/models/ids';
import { updateParentControlsAction } from '@modules/learner/presentation/actions/update-parent-controls-action';
import { ParentControlsForm } from '@modules/learner/presentation/components/parent-controls-form';
import { ParentHelp } from '@modules/learner/presentation/components/parent-help';
import { ParentTaskDetail } from '@modules/learner/presentation/components/parent-task-detail';
import { ParentTaskList } from '@modules/learner/presentation/components/parent-task-list';
import { ParentTime } from '@modules/learner/presentation/components/parent-time';
import { exploredTopics } from '@modules/learner/presentation/components/parent-topics';
import type { ChildProfileDto } from '@modules/learner/presentation/dto/learner-dto';
import deCatalog from '@modules/learner/presentation/i18n/de.json';
import enCatalog from '@modules/learner/presentation/i18n/en.json';
import { updateParentControlsSchema } from '@modules/learner/presentation/schemas/parent-controls-schema';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import type * as I18n from '@i18n';

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('@i18n', async (original) => ({
  ...(await original<typeof I18n>()),
  useRouter: () => ({ refresh }),
}));
vi.mock('@modules/learner/presentation/actions/update-parent-controls-action', () => ({
  updateParentControlsAction: vi.fn(),
}));
const profile: ChildProfileDto = {
  id: 'own',
  displayName: 'Alexandertheodor',
  federalState: 'HE',
  grade: 2,
  tutorId: 'max',
  interests: ['nature'],
  voiceEnabled: false,
  voiceConsent: false,
  dailyLimitMinutes: 30,
  allowedWindow: null,
  learningInsights: false,
  guardianConfirmed: true,
  welcomeCompletedAt: '2026-10-25T10:00:00Z',
};
const empty: ParentLearningRecords = {
  tasks: [],
  assignments: [],
  tasksTruncated: false,
  assignmentsTruncated: false,
};
const en = enCatalog.learner;
const de = deCatalog.learner;

describe('parent dashboard presentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it.each([
    ['en', en],
    ['de', de],
  ] as const)('shows an honest empty state in %s without a chart', (locale, messages) => {
    render(
      <I18nClientProvider
        locale={locale}
        messages={{ learner: messages }}
        timeZone="Europe/Berlin"
        isDevelopment={false}
      >
        <ParentTaskList records={empty} />
      </I18nClientProvider>,
    );
    expect(screen.getByText(messages.dashboard.emptyTitle)).toBeInTheDocument();
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  });
  it('preserves the settings on failure and succeeds only after a confirmed retry', async () => {
    vi.mocked(updateParentControlsAction)
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'learner.persistence_failed', message: 'Unavailable' },
      })
      .mockResolvedValueOnce({ ok: true, data: { ...profile, learningInsights: true } });
    render(
      <I18nClientProvider
        locale="en"
        messages={{ learner: en }}
        timeZone="Europe/Berlin"
        isDevelopment={false}
      >
        <ParentControlsForm profile={profile} />
      </I18nClientProvider>,
    );
    fireEvent.click(screen.getByRole('switch', { name: en.controls.insights.title }));
    fireEvent.click(screen.getByRole('button', { name: en.dashboard.save }));
    expect(screen.queryByText(en.dashboard.saved)).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(en.dashboard.saveError),
    );
    expect(screen.getByRole('switch', { name: en.controls.insights.title })).toBeChecked();
    expect(refresh).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: en.dashboard.retry })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: en.dashboard.retry }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(en.dashboard.saved));
    expect(refresh).toHaveBeenCalled();
    expect(vi.mocked(updateParentControlsAction).mock.calls[0]?.[0]).not.toHaveProperty('tutorId');
    expect(vi.mocked(updateParentControlsAction).mock.calls[0]?.[0]).not.toHaveProperty(
      'interests',
    );
  });
  it('rejects attempts to submit child choices or a voice setting', () => {
    const values = {
      profileId: 'own',
      dailyLimitMinutes: '30',
      windowEnabled: false,
      windowFrom: '900',
      windowUntil: '1080',
      learningInsights: false,
    };
    expect(updateParentControlsSchema.safeParse({ ...values, tutorId: 'fina' }).success).toBe(
      false,
    );
    expect(updateParentControlsSchema.safeParse({ ...values, interests: ['art'] }).success).toBe(
      false,
    );
    expect(updateParentControlsSchema.safeParse({ ...values, voiceEnabled: true }).success).toBe(
      false,
    );
    expect(updateParentControlsSchema.safeParse(values).success).toBe(true);
  });
});

const hintedTask: ParentTaskWithAssignment = {
  id: toParentTaskId('session-1'),
  assignmentId: null,
  status: 'COMPLETED',
  startedAt: '2026-10-25T10:00:00Z',
  updatedAt: '2026-10-25T10:20:00Z',
  endedAt: '2026-10-25T10:20:00Z',
  hintCount: 2,
  hintLevels: ['UNDERSTAND_TASK', 'NEXT_STEP'],
  answers: { given: 2, results: { CORRECT: 1, PARTLY_CORRECT: 0, NOT_YET: 1 } },
  questionsAsked: 1,
  questionsAnswered: 1,
  subject: 'MATH',
  competencyCode: null,
  assignment: null,
};
const metrics = {
  insightTasks: 2,
  hintedTasks: 1,
  helpLevels: [{ level: 'NEXT_STEP', tasks: 1 }],
} as unknown as ParentLearningMetrics;

describe('parent help evidence', () => {
  it.each([
    ['en', en],
    ['de', de],
  ] as const)('names the used hint rungs and the answer checks in %s', (locale, messages) => {
    render(
      <I18nClientProvider
        locale={locale}
        messages={{ learner: messages }}
        timeZone="Europe/Berlin"
        isDevelopment={false}
      >
        <ParentTaskDetail task={hintedTask} topic={null} />
      </I18nClientProvider>,
    );
    const ladder = screen.getByRole('list', { name: messages.dashboard.helpLadder });
    expect(ladder).toHaveTextContent(
      `${messages.dashboard.helpLevels.NEXT_STEP} ${messages.dashboard.helpUsed}`,
    );
    expect(ladder).toHaveTextContent(
      `${messages.dashboard.helpLevels.SIMILAR_EXAMPLE} ${messages.dashboard.helpNotUsed}`,
    );
    expect(screen.getByText(messages.dashboard.answerResults.NOT_YET)).toBeInTheDocument();
    expect(screen.queryByText(/weak|schwach|grade [A-F1-6]|Note [1-6]/i)).not.toBeInTheDocument();
  });
  it('names an assignment task by its title and subject, never by its task text', () => {
    render(
      <I18nClientProvider
        locale="en"
        messages={{ learner: en }}
        timeZone="Europe/Berlin"
        isDevelopment={false}
      >
        <ParentTaskDetail
          task={{ ...hintedTask, assignment: { title: 'Viertel und Hälften', subject: 'MATH' } }}
          topic={null}
        />
      </I18nClientProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Viertel und Hälften' })).toBeInTheDocument();
    expect(
      screen.getByText(
        en.dashboard.taskFromAssignment.replace('{subject}', en.dashboard.subjects.MATH),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/brought in/)).not.toBeInTheDocument();
  });
  it('shows no hint evidence and links to settings while notes are off', () => {
    render(
      <I18nClientProvider
        locale="en"
        messages={{ learner: en }}
        timeZone="Europe/Berlin"
        isDevelopment={false}
      >
        <ParentHelp metrics={metrics} insightsEnabled={false} scope="" />
      </I18nClientProvider>,
    );
    expect(screen.getByText(en.dashboard.insightsOff)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: en.dashboard.openSettings })).toHaveAttribute(
      'href',
      expect.stringContaining('section=settings'),
    );
    expect(screen.queryByRole('figure')).not.toBeInTheDocument();
  });
  it('scales help bars against the tasks with known hints', () => {
    render(
      <I18nClientProvider
        locale="en"
        messages={{ learner: en }}
        timeZone="Europe/Berlin"
        isDevelopment={false}
      >
        <ParentHelp metrics={metrics} insightsEnabled scope="" />
      </I18nClientProvider>,
    );
    expect(screen.getByRole('figure')).toHaveTextContent(en.dashboard.helpLevels.NEXT_STEP);
    expect(document.querySelector('[style*="width"]')).toHaveStyle({ width: '50%' });
  });
});

describe('topics explored', () => {
  const at = (
    id: string,
    subject: ParentTaskWithAssignment['subject'],
    competencyCode: string | null,
  ) => ({
    ...hintedTask,
    id: toParentTaskId(id),
    subject,
    competencyCode,
  });
  const topics = {
    'kc@1:a': { section: 'Brüche', statement: 'erkennen Anteile' },
    'kc@1:b': { section: null, statement: 'nutzen das Einmaleins' },
  };
  it('counts tasks per topic and subject, names a topic without section by its statement', () => {
    const result = exploredTopics(
      [
        at('1', 'MATH', 'kc@1:a'),
        at('2', 'MATH', 'kc@1:a'),
        at('3', 'MATH', 'kc@1:b'),
        at('4', 'GERMAN', 'kc@1:a'),
      ],
      topics,
    );
    expect(result.explored).toEqual([
      { subject: 'MATH', label: 'Brüche', tasks: 2 },
      { subject: 'GERMAN', label: 'Brüche', tasks: 1 },
      { subject: 'MATH', label: 'nutzen das Einmaleins', tasks: 1 },
    ]);
    expect(result.unclassified).toBe(0);
  });
  it('counts unclassified and undescribed tasks apart instead of guessing a topic', () => {
    const result = exploredTopics([at('1', 'MATH', null), at('2', 'MATH', 'material:x:y')], topics);
    expect(result).toEqual({ explored: [], unclassified: 2 });
  });
});

describe('parent time and limits', () => {
  const noon = new Date('2026-10-25T11:00:00Z');
  const time = (usedMinutes: number | null) =>
    render(
      <I18nClientProvider
        locale="en"
        messages={{ learner: en }}
        timeZone="Europe/Berlin"
        isDevelopment={false}
      >
        <ParentTime
          profile={profile}
          screenTime={computeScreenTime({ controls: profile, now: noon, usedMinutes })}
        />
      </I18nClientProvider>,
    );
  it('shows measured minutes against the limit and the calm open state', () => {
    time(12);
    expect(screen.getByText('12 minutes')).toBeInTheDocument();
    expect(screen.getByText('18 minutes left of 30 today')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(en.dashboard.timeStatus.open);
  });
  it('says the limit is reached without pressure wording', () => {
    time(30);
    expect(screen.getByRole('status')).toHaveTextContent(
      en.dashboard.timeStatus.closed_limit_reached,
    );
    expect(screen.queryByText(/hurry|quick|!/i)).not.toBeInTheDocument();
  });
  it('shows "not available" instead of zero when the measurement could not be read', () => {
    time(null);
    expect(screen.getByText(en.dashboard.timeUnavailable)).toBeInTheDocument();
    expect(screen.queryByText('0 minutes')).not.toBeInTheDocument();
  });
});

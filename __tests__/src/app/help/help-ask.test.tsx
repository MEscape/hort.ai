import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChildAssignmentView } from '@modules/assignments/client';
import assignmentMessages from '@modules/assignments/presentation/i18n/en.json';
import { startHelpSessionAction } from '@modules/guidance/client';
import guidanceMessages from '@modules/guidance/presentation/i18n/en.json';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import { HelpAsk } from '@/app/[locale]/(app)/help/_components/help-ask';
import type { OpenTask, StartTopic } from '@/app/[locale]/(app)/help/_components/help-ask';
import app from '@/i18n/messages/en.json';

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('@i18n', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => router,
}));
vi.mock('@modules/guidance/client', () => ({ startHelpSessionAction: vi.fn() }));

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

const TOPIC: StartTopic = {
  areaId: 'zahlenwald',
  placeId: 'plus-mulde',
  subject: 'math',
  name: 'Zahlenwald · Plus-Mulde',
};

const ASSIGNMENT: ChildAssignmentView = {
  id: 'a1',
  title: 'Divide marbles',
  taskText: 'Share 36 marbles among 4.',
  dueDate: null,
};

interface AskOptions {
  readonly openTask?: OpenTask | null;
  readonly topic?: StartTopic | null;
  readonly assignments?: readonly ChildAssignmentView[] | null;
}

function renderAsk({ openTask = null, topic = null, assignments = null }: AskOptions = {}) {
  return render(
    <I18nClientProvider
      locale="en"
      messages={{
        app,
        assignments: assignmentMessages.assignments,
        guidance: guidanceMessages.guidance,
      }}
      timeZone="Europe/Berlin"
      isDevelopment
    >
      <HelpAsk
        childProfileId="c1"
        companion={COMPANION}
        openTask={openTask}
        topic={topic}
        assignments={assignments}
      />
    </I18nClientProvider>,
  );
}

function typeTask(text: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Your task' }), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
}

describe('asking for the task on the help canvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    vi.mocked(startHelpSessionAction).mockResolvedValue({ ok: true, data: {} as never });
  });

  it('asks on the stage right away: no start page, no chat, the companion says what to do', () => {
    renderAsk();

    expect(screen.getByRole('heading', { level: 1, name: app.start.entry.title })).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Your task' })).toBeVisible();
    expect(screen.getByText(app.start.ask.line)).toBeVisible();
  });

  it('starts the child’s own task and shows the session on the same screen', async () => {
    renderAsk();
    typeTask('Add 23 and 24');

    await waitFor(() => {
      expect(startHelpSessionAction).toHaveBeenCalledWith({
        childProfileId: 'c1',
        task: 'Add 23 and 24',
        subject: 'math',
      });
    });
    expect(router.push).toHaveBeenCalledWith('/help');
    expect(router.refresh).toHaveBeenCalled();
  });

  it('names the island and sends island, place and subject with the task', async () => {
    renderAsk({ topic: TOPIC });
    expect(screen.getByText('Island: Zahlenwald · Plus-Mulde')).toBeVisible();

    typeTask('Add 23 and 24');
    await waitFor(() => {
      expect(startHelpSessionAction).toHaveBeenCalledWith({
        childProfileId: 'c1',
        task: 'Add 23 and 24',
        subject: 'math',
        areaId: 'zahlenwald',
        placeId: 'plus-mulde',
      });
    });
  });

  it('clears the draft and asks for text before sending an empty task', () => {
    renderAsk();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    const task = screen.getByRole('textbox', { name: 'Your task' });

    expect(task).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('Write your task here first.');
    fireEvent.change(task, { target: { value: 'Read page 12.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Clear text' }));
    expect(task).toHaveValue('');
    expect(startHelpSessionAction).not.toHaveBeenCalled();
  });

  it('asks before a new task replaces the open one, and only then starts it', async () => {
    renderAsk({ openTask: { task: 'Add 347 and 256', assignmentId: null } });
    typeTask('Read page 12.');

    expect(screen.getByText(/“Add 347 and 256” is still open/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Carry on with it' })).toHaveAttribute(
      'href',
      expect.stringContaining('/help'),
    );
    expect(startHelpSessionAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Start the new task' }));
    await waitFor(() => {
      expect(startHelpSessionAction).toHaveBeenCalledWith(
        expect.objectContaining({ task: 'Read page 12.' }),
      );
    });
  });

  it('just continues when the child types the open task again', async () => {
    renderAsk({ openTask: { task: 'Add 347 and 256', assignmentId: null } });
    typeTask('  Add 347 and 256 ');

    expect(screen.queryByText(/is still open/)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(startHelpSessionAction).toHaveBeenCalled();
    });
  });

  it('offers the teacher’s assignments as choices and asks before one replaces another task', async () => {
    renderAsk({
      openTask: { task: 'Add 347 and 256', assignmentId: null },
      assignments: [ASSIGNMENT],
    });
    fireEvent.click(screen.getByRole('button', { name: /Divide marbles/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start with this task' }));

    expect(screen.getByText(/“Add 347 and 256” is still open/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Start the new task' }));
    await waitFor(() => {
      expect(startHelpSessionAction).toHaveBeenCalledWith(
        expect.objectContaining({ assignmentId: 'a1' }),
      );
    });
  });

  it('does not ask when the open task is this same assignment', async () => {
    renderAsk({
      openTask: { task: 'Share 36 marbles among 4.', assignmentId: 'a1' },
      assignments: [ASSIGNMENT],
    });
    fireEvent.click(screen.getByRole('button', { name: /Divide marbles/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start with this task' }));

    expect(screen.queryByText(/is still open/)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(startHelpSessionAction).toHaveBeenCalled();
    });
  });

  it('shows no school block when there are no assignments to show', () => {
    renderAsk({ assignments: [] });

    expect(screen.queryByRole('heading', { name: 'Tasks from your teacher' })).toBeNull();
  });

  it('points a child in distress to a trusted adult, keeps the text and offers no retry', async () => {
    vi.mocked(startHelpSessionAction).mockResolvedValue({
      ok: false,
      error: { code: 'guidance.child_distress', message: 'refused' },
    } as never);
    renderAsk();
    typeTask('Mein Papa schlägt mich');

    expect(await screen.findByRole('alert')).toHaveTextContent('a grown-up you trust');
    expect(screen.getByRole('textbox', { name: 'Your task' })).toHaveValue(
      'Mein Papa schlägt mich',
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it('says calmly that it is break time when the learning time is closed', async () => {
    vi.mocked(startHelpSessionAction).mockResolvedValue({
      ok: false,
      error: { code: 'guidance.learning_paused', message: 'refused' },
    } as never);
    renderAsk();
    typeTask('Rechne 23 + 24.');

    expect(await screen.findByText(/break time now/)).toBeVisible();
    expect(router.push).not.toHaveBeenCalled();
  });
});

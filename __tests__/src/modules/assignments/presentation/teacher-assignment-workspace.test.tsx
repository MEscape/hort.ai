import type { AnchorHTMLAttributes } from 'react';

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TeacherAssignmentView } from '@modules/assignments/application/contracts/assignment-views';
import { TeacherAssignmentWorkspace } from '@modules/assignments/presentation/components/teacher-assignment-workspace';
import messages from '@modules/assignments/presentation/i18n/en.json';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import type * as I18n from '@i18n';

const push = vi.hoisted(() => vi.fn());
vi.mock('@i18n', async (original) => ({
  ...(await original<typeof I18n>()),
  useRouter: () => ({ push }),
  // A plain anchor: the class links are tested for what the workspace does before navigating.
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

const actions = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('@modules/assignments/presentation/actions/create-assignment-action', () => ({
  createAssignmentAction: actions.create,
}));
vi.mock('@modules/assignments/presentation/actions/update-assignment-action', () => ({
  updateAssignmentAction: actions.update,
}));
vi.mock('@modules/assignments/presentation/actions/delete-assignment-action', () => ({
  deleteAssignmentAction: actions.remove,
}));

const SAVED: TeacherAssignmentView = {
  id: 'assignment-1',
  title: 'Read a story',
  taskText: 'Read page 12. What happens first?',
  dueDate: '2026-03-29',
  solutionKey: 'TEACHER_PRIVATE_KEY',
};

const CLASSROOMS = [
  { id: 'class-a', name: '3a', grade: 3 },
  { id: 'class-b', name: '4b', grade: 4 },
];

function Workspace({
  assignments = [],
  classrooms = CLASSROOMS,
}: {
  readonly assignments?: readonly TeacherAssignmentView[];
  readonly classrooms?: typeof CLASSROOMS;
}) {
  return (
    <I18nClientProvider locale="en" timeZone="Pacific/Kiritimati" messages={messages} isDevelopment>
      <TeacherAssignmentWorkspace
        classrooms={classrooms}
        classroomId="class-a"
        classroomName="3a"
        assignments={assignments}
        classroomActions={<button type="button">Add class</button>}
      />
    </I18nClientProvider>
  );
}

function renderWorkspace(assignments: readonly TeacherAssignmentView[] = []) {
  return render(<Workspace assignments={assignments} />);
}

async function fill(label: string, value: string) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  });
}

function leavingIsGuarded(): boolean {
  const leave = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(leave);
  return leave.defaultPrevented;
}

describe('teacher assignment workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    actions.create.mockResolvedValue({ ok: true, data: SAVED });
    actions.update.mockResolvedValue({ ok: true, data: SAVED });
    actions.remove.mockResolvedValue({ ok: true, data: undefined });
  });

  it('validates, previews only child fields, and saves a new assignment to the class', async () => {
    renderWorkspace();
    expect(screen.getByRole('heading', { name: 'No assignments yet' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New assignment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save assignment' }));
    await screen.findByText('Enter an assignment title.');
    await waitFor(() => {
      expect(screen.getByLabelText('Assignment title')).toHaveFocus();
    });
    expect(actions.create).not.toHaveBeenCalled();

    await fill('Assignment title', SAVED.title);
    await fill('Task text', SAVED.taskText);
    await fill('Due date (optional)', '2026-03-29');
    await fill('Solution key (optional)', 'TEACHER_PRIVATE_KEY');
    expect(leavingIsGuarded()).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Preview as a child' }));
    await screen.findByRole('heading', { name: 'Child preview' });
    expect(screen.getByRole('heading', { name: SAVED.title })).toBeInTheDocument();
    expect(screen.getByText('Due: March 29, 2026')).toBeInTheDocument();
    expect(screen.queryByText('TEACHER_PRIVATE_KEY')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Solution key (optional)')).toHaveValue('TEACHER_PRIVATE_KEY');

    fireEvent.click(screen.getByRole('button', { name: 'Save assignment' }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Assignment saved.');
    });
    expect(actions.create).toHaveBeenCalledWith({
      classroomId: 'class-a',
      title: SAVED.title,
      taskText: SAVED.taskText,
      dueDate: '2026-03-29',
      solutionKey: 'TEACHER_PRIVATE_KEY',
    });
    expect(screen.getByRole('heading', { name: 'Assignments for 3a' })).toBeInTheDocument();
    await waitFor(() => {
      expect(leavingIsGuarded()).toBe(false);
    });
  });

  it('keeps the input and marks the field when the server refuses the assignment', async () => {
    actions.create.mockResolvedValue({
      ok: false,
      error: {
        code: 'assignments.validation_failed',
        message: 'invalid',
        fieldErrors: { title: ['assignments.validation.title_too_long'] },
      },
    });
    renderWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'New assignment' }));
    await fill('Assignment title', 'Title');
    await fill('Task text', 'Task');
    fireEvent.click(screen.getByRole('button', { name: 'Save assignment' }));
    expect(await screen.findByText('The title must be 120 characters or fewer.')).toBeVisible();
    expect(screen.getByLabelText('Task text')).toHaveValue('Task');
    expect(screen.queryByRole('status')).toBeEmptyDOMElement();
  });

  it('shows a form-level message when saving fails for another reason', async () => {
    actions.create.mockResolvedValue({
      ok: false,
      error: { code: 'assignments.persistence_failed', message: 'failed' },
    });
    renderWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'New assignment' }));
    await fill('Assignment title', 'Title');
    await fill('Task text', 'Task');
    fireEvent.click(screen.getByRole('button', { name: 'Save assignment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The assignment could not be saved because of a service error.',
    );
  });

  it('asks before discarding changes and keeps them when asked to', async () => {
    renderWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'New assignment' }));
    await fill('Assignment title', 'Draft');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Discard your changes?');
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Assignment title')).toHaveValue('Draft');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(screen.getByRole('heading', { name: 'No assignments yet' })).toBeInTheDocument();
    expect(actions.create).not.toHaveBeenCalled();
  });

  it('keeps an unsaved draft when browser back/forward replaces the class editor (#85)', async () => {
    const first = renderWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'New assignment' }));
    await fill('Assignment title', 'Draft title');
    await fill('Task text', 'Draft task');
    // History navigation to another class and back: no click, the keyed editor is unmounted.
    first.unmount();

    renderWorkspace();
    expect(await screen.findByLabelText('Assignment title')).toHaveValue('Draft title');
    expect(screen.getByLabelText('Task text')).toHaveValue('Draft task');
    expect(leavingIsGuarded()).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(window.sessionStorage.length).toBe(0);
  });

  it('does not restore a stale draft after all changes were reverted to the baseline', async () => {
    const first = renderWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'New assignment' }));
    await fill('Assignment title', 'Temporary title');
    expect(window.sessionStorage.length).toBe(1);
    await fill('Assignment title', '');
    expect(window.sessionStorage.length).toBe(0);
    first.unmount();

    renderWorkspace();
    expect(screen.getByRole('heading', { name: 'No assignments yet' })).toBeVisible();
    expect(screen.queryByLabelText('Assignment title')).not.toBeInTheDocument();
  });

  it('edits a saved assignment with its stored values', async () => {
    renderWorkspace([SAVED]);
    expect(screen.getByText('Solution key saved')).toBeInTheDocument();
    expect(screen.queryByText('TEACHER_PRIVATE_KEY')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `Edit “${SAVED.title}”` }));
    expect(screen.getByRole('heading', { name: 'Edit assignment' })).toBeInTheDocument();
    expect(screen.getByLabelText('Solution key (optional)')).toHaveValue('TEACHER_PRIVATE_KEY');
    await fill('Assignment title', 'Read two stories');
    fireEvent.click(screen.getByRole('button', { name: 'Save assignment' }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Assignment saved.');
    });
    expect(actions.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: SAVED.id, title: 'Read two stories' }),
    );
  });

  it('deletes only after confirmation and reports a refused deletion', async () => {
    renderWorkspace([SAVED]);
    fireEvent.click(screen.getByRole('button', { name: `Delete “${SAVED.title}”` }));
    const prompt = screen.getByRole('alert');
    expect(prompt).toHaveTextContent(`Delete “${SAVED.title}”?`);
    expect(within(prompt).getByRole('button', { name: 'Keep assignment' })).toHaveFocus();
    fireEvent.click(within(prompt).getByRole('button', { name: 'Keep assignment' }));
    expect(actions.remove).not.toHaveBeenCalled();

    actions.remove.mockResolvedValueOnce({
      ok: false,
      error: { code: 'assignments.not_found', message: 'missing' },
    });
    fireEvent.click(screen.getByRole('button', { name: `Delete “${SAVED.title}”` }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete assignment' }));
    expect(await screen.findByText(/This assignment no longer exists/)).toBeVisible();

    fireEvent.click(await screen.findByRole('button', { name: 'Delete assignment' }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Assignment deleted.');
    });
    expect(actions.remove).toHaveBeenLastCalledWith({ id: SAVED.id });
  });

  describe('switching classes', () => {
    const classB = () => screen.getByRole('link', { name: /^4b/ });

    it('asks before discarding an unsaved draft, and keeps it when asked to', async () => {
      renderWorkspace();
      fireEvent.click(screen.getByRole('button', { name: 'New assignment' }));
      await fill('Assignment title', 'Unsaved draft');

      expect(fireEvent.click(classB())).toBe(false);
      expect(screen.getByRole('alert')).toHaveTextContent('Switch class and discard your changes?');
      expect(push).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
      expect(screen.getByLabelText('Assignment title')).toHaveValue('Unsaved draft');
      expect(push).not.toHaveBeenCalled();

      fireEvent.click(classB());
      fireEvent.click(screen.getByRole('button', { name: 'Discard and switch class' }));
      expect(push).toHaveBeenCalledWith('/teacher/assignments?classroom=class-b');
    });

    it('switches straight away when nothing is unsaved', () => {
      renderWorkspace();
      expect(fireEvent.click(classB())).toBe(true);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('blocks switching while a save is running', async () => {
      actions.create.mockReturnValue(new Promise(() => undefined));
      renderWorkspace();
      fireEvent.click(screen.getByRole('button', { name: 'New assignment' }));
      await fill('Assignment title', 'Title');
      await fill('Task text', 'Task');
      fireEvent.click(screen.getByRole('button', { name: 'Save assignment' }));
      await screen.findByRole('button', { name: 'Saving …' });

      expect(fireEvent.click(classB())).toBe(false);
      expect(classB()).toHaveAttribute('aria-disabled', 'true');
      expect(screen.queryByText('Switch class and discard your changes?')).not.toBeInTheDocument();
      expect(push).not.toHaveBeenCalled();
    });

    it('keeps an unsaved draft when another class is created and the page refreshes', async () => {
      const view = renderWorkspace();
      expect(screen.getByRole('button', { name: 'Add class' })).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: 'New assignment' }));
      await fill('Assignment title', 'Unsaved draft');

      // The refresh after "Add class": one more class, the selected one unchanged.
      view.rerender(
        <Workspace classrooms={[...CLASSROOMS, { id: 'class-c', name: '2c', grade: 2 }]} />,
      );
      expect(screen.getByRole('link', { name: /^2c/ })).toBeInTheDocument();
      expect(screen.getByLabelText('Assignment title')).toHaveValue('Unsaved draft');
    });
  });
});

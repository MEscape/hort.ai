import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AssignmentWorkspace } from '@modules/assignments/presentation/components/assignment-workspace';
import { toChildAssignmentView } from '@modules/assignments/presentation/dto/child-assignment-dto';
import messages from '@modules/assignments/presentation/i18n/en.json';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

describe('assignment draft preview', () => {
  it('validates, protects an unsaved draft, and projects only safe child fields through edit/preview/discard', async () => {
    render(
      <I18nClientProvider
        locale="en"
        timeZone="Pacific/Kiritimati"
        messages={messages}
        isDevelopment
      >
        <AssignmentWorkspace />
      </I18nClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'New assignment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Preview as a child' }));
    await screen.findByText('Enter an assignment title.');
    const title = screen.getByLabelText('Assignment title');
    await waitFor(() => {
      expect(title).toHaveFocus();
    });
    expect(title).toHaveAttribute('aria-invalid', 'true');

    const draft = {
      title: 'Read a story',
      taskText: 'Read page 12. What happens first?',
      dueDate: '2026-03-29',
      solutionKey: 'TEACHER_PRIVATE_KEY',
    };
    await act(async () => {
      fireEvent.change(title, { target: { value: draft.title } });
      fireEvent.change(screen.getByLabelText('Task text'), { target: { value: draft.taskText } });
      fireEvent.change(screen.getByLabelText('Due date (optional)'), {
        target: { value: draft.dueDate },
      });
      fireEvent.change(screen.getByLabelText('Solution key (optional)'), {
        target: { value: draft.solutionKey },
      });
    });

    const leave = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leave);
    expect(leave.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Preview as a child' }));
    await screen.findByRole('heading', { name: 'Child preview' });
    expect(screen.getByRole('heading', { name: draft.title })).toBeInTheDocument();
    expect(screen.getByText(draft.taskText)).toBeInTheDocument();
    expect(screen.getByText('Due: March 29, 2026')).toBeInTheDocument();
    expect(screen.queryByText(draft.solutionKey)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Solution key (optional)')).not.toBeInTheDocument();
    expect(Object.keys(toChildAssignmentView(draft)).sort()).toEqual([
      'dueDate',
      'taskText',
      'title',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Assignment title')).toHaveValue(draft.title);
    expect(screen.getByLabelText('Solution key (optional)')).toHaveValue(draft.solutionKey);
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Assignment title'), {
        target: { value: 'Updated title' },
      });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview as a child' }));
    await screen.findByRole('heading', { name: 'Updated title' });
    fireEvent.click(screen.getByRole('button', { name: 'Back to overview' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Discard this draft?');
    fireEvent.click(screen.getByRole('button', { name: 'Keep the draft' }));
    expect(screen.getByRole('heading', { name: 'Updated title' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to overview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
    expect(screen.getByRole('heading', { name: 'No assignments yet' })).toBeInTheDocument();
    const afterDiscard = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(afterDiscard);
    expect(afterDiscard.defaultPrevented).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'New assignment' }));
    expect(screen.getByLabelText('Assignment title')).toHaveValue('');
    expect(screen.getByLabelText('Solution key (optional)')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'My assignments' })).toBeInTheDocument();
  });
});

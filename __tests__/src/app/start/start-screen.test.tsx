import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ChildAssignmentView } from '@modules/assignments/client';
import assignmentMessages from '@modules/assignments/presentation/i18n/en.json';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import { APP_IDENTITY } from '@lib/config';

import { StartPageShell } from '@/app/[locale]/(public)/start/_components/start-page-shell';
import { StartScreen } from '@/app/[locale]/(public)/start/_components/start-screen';
import app from '@/i18n/messages/en.json';

function renderStart(schoolAssignments: readonly ChildAssignmentView[] | null = null) {
  return render(
    <I18nClientProvider
      locale="en"
      messages={{ app, assignments: assignmentMessages.assignments }}
      timeZone="Europe/Berlin"
      isDevelopment
    >
      <StartPageShell>
        <StartScreen schoolAssignments={schoolAssignments} />
      </StartPageShell>
    </I18nClientProvider>,
  );
}

describe('integrated homework start screen', () => {
  it('uses the official Hort.ai branding on the existing start screen', () => {
    const { container } = renderStart();
    expect(screen.getByRole('img', { name: APP_IDENTITY.name })).toHaveAttribute(
      'src',
      APP_IDENTITY.assets.logo,
    );
    expect(
      container.querySelector(`use[href="${APP_IDENTITY.assets.owl}#face-hello"]`),
    ).not.toBeNull();
    expect(screen.getByRole('button', { name: 'My task' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'School tasks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
  });

  it('clears a local task without submitting the form', () => {
    renderStart();
    fireEvent.click(screen.getByRole('button', { name: 'My task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    const task = screen.getByRole('textbox', { name: 'Your task' });
    expect(task).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('Write your task here first.');
    fireEvent.change(task, { target: { value: 'Read page 12.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('status')).toHaveTextContent('Your task was not sent or saved.');
    const clear = screen.getByRole('button', { name: 'Clear text' });
    expect(clear).toHaveProperty('type', 'button');
    fireEvent.click(clear);
    expect(task).toHaveValue('');
    expect(task).toHaveFocus();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'My task' })).toHaveFocus();
  });

  it('says school tasks are unavailable when no child class could be loaded', () => {
    renderStart(null);
    fireEvent.click(screen.getByRole('button', { name: 'School tasks' }));
    expect(screen.getByRole('heading', { name: 'School tasks' })).toHaveFocus();
    expect(screen.getByText("Tasks from your teacher aren't available here yet.")).toBeVisible();
  });

  it('lists the class assignments and shows one without claiming that help has started', () => {
    renderStart([
      { id: 'a1', title: 'Divide marbles', taskText: 'Share 36 marbles among 4.', dueDate: null },
      { id: 'a2', title: 'Add numbers', taskText: '347 + 256', dueDate: '2026-11-02' },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'School tasks' }));
    expect(screen.getByRole('heading', { name: 'Tasks from your teacher' })).toHaveFocus();
    expect(screen.getByText('Due: November 2, 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Divide marbles/ }));
    expect(screen.getByRole('button', { name: 'All tasks' })).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Divide marbles' })).toBeInTheDocument();
    expect(screen.getByText('Share 36 marbles among 4.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Help with school tasks is coming soon');
    fireEvent.click(screen.getByRole('button', { name: 'All tasks' }));
    expect(screen.getByRole('heading', { name: 'Tasks from your teacher' })).toHaveFocus();
    expect(screen.getByRole('button', { name: /Add numbers/ })).toBeInTheDocument();
  });

  it('tells the child when the class has no assignments yet', () => {
    renderStart([]);
    fireEvent.click(screen.getByRole('button', { name: 'School tasks' }));
    expect(screen.getByText('Your teacher has not posted any tasks yet.')).toBeInTheDocument();
  });
});

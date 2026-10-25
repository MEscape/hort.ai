import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChildClassroomPanel } from '@modules/classroom/presentation/components/child-classroom-panel';
import messages from '@modules/classroom/presentation/i18n/en.json';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import type * as I18n from '@i18n';

const refresh = vi.fn();
const actions = vi.hoisted(() => ({ join: vi.fn(), leave: vi.fn() }));
vi.mock('@i18n', async (original) => ({
  ...(await original<typeof I18n>()),
  useRouter: () => ({ refresh }),
}));
vi.mock('@modules/classroom/presentation/actions/join-classroom-action', () => ({
  joinClassroomAction: actions.join,
}));
vi.mock('@modules/classroom/presentation/actions/leave-classroom-action', () => ({
  leaveClassroomAction: actions.leave,
}));

function renderPanel(classroom: { name: string; grade: number } | null) {
  return render(
    <I18nClientProvider locale="en" timeZone="Europe/Berlin" messages={messages} isDevelopment>
      <ChildClassroomPanel childProfileId="child-1" childName="Mia" classroom={classroom} />
    </I18nClientProvider>,
  );
}

async function submitCode(code: string) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: code } });
  });
  fireEvent.click(screen.getByRole('button', { name: 'Join class' }));
}

describe('child classroom panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.join.mockResolvedValue({ ok: true, data: {} });
    actions.leave.mockResolvedValue({ ok: true, data: undefined });
  });

  it("joins the server-given child with the teacher's code and reloads the page data", async () => {
    renderPanel(null);
    await submitCode(' abcd-efgh ');
    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    expect(actions.join).toHaveBeenCalledWith({
      childProfileId: 'child-1',
      inviteCode: ' abcd-efgh ',
    });
  });

  it('marks the code field when the server refuses the code, and keeps the input', async () => {
    actions.join.mockResolvedValue({
      ok: false,
      error: { code: 'classroom.invite_code_invalid', message: 'invalid' },
    });
    renderPanel(null);
    await submitCode('WRONG-CODE');
    expect(await screen.findByText(/This code is not valid/)).toBeVisible();
    expect(screen.getByLabelText('Invite code')).toHaveValue('WRONG-CODE');
    expect(screen.getByLabelText('Invite code')).toHaveAttribute('aria-invalid', 'true');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('explains that a child already in another class must leave it first', async () => {
    actions.join.mockResolvedValue({
      ok: false,
      error: { code: 'classroom.child_already_in_classroom', message: 'conflict' },
    });
    renderPanel(null);
    await submitCode('ABCD-EFGH');
    expect(await screen.findByRole('alert')).toHaveTextContent('Your child is already in a class.');
  });

  it('shows the current class and leaves it only after confirmation', async () => {
    renderPanel({ name: '3a', grade: 3 });
    expect(screen.getByRole('status')).toHaveTextContent('Mia is in class 3a (grade 3).');
    expect(screen.queryByLabelText('Invite code')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Leave class' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stay in the class' }));
    expect(actions.leave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Leave class' }));
    expect(screen.getByText('Leave class 3a?')).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Leave class' }));
    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    expect(actions.leave).toHaveBeenCalledWith({ childProfileId: 'child-1' });
  });
});

import type { ReactNode } from 'react';

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddClassroomDialog } from '@modules/classroom/presentation/components/add-classroom-dialog';
import { ClassroomCreationProvider } from '@modules/classroom/presentation/components/classroom-creation-provider';
import { CreateClassroomForm } from '@modules/classroom/presentation/components/create-classroom-form';
import { InviteCodeSection } from '@modules/classroom/presentation/components/invite-code-section';
import messages from '@modules/classroom/presentation/i18n/en.json';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import type * as I18n from '@i18n';

const router = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));
const actions = vi.hoisted(() => ({ create: vi.fn(), regenerate: vi.fn() }));
vi.mock('@i18n', async (original) => ({
  ...(await original<typeof I18n>()),
  useRouter: () => router,
}));
vi.mock('@modules/classroom/presentation/actions/create-classroom-action', () => ({
  createClassroomAction: actions.create,
}));
vi.mock('@modules/classroom/presentation/actions/regenerate-invite-code-action', () => ({
  regenerateInviteCodeAction: actions.regenerate,
}));

const CREATED = {
  ok: true,
  data: { classroom: { id: 'class-1', name: '3b', grade: 3 }, inviteCode: 'ACDE-FHJK' },
};

function withI18n(children: ReactNode) {
  return (
    <I18nClientProvider locale="en" timeZone="Europe/Berlin" messages={messages} isDevelopment>
      {children}
    </I18nClientProvider>
  );
}

/** The page: the provider stays, the part below it switches once a class exists. */
function Page({ hasClass }: { readonly hasClass: boolean }) {
  return withI18n(
    <ClassroomCreationProvider>
      {hasClass ? <p>Overview</p> : <CreateClassroomForm />}
    </ClassroomCreationProvider>,
  );
}

async function createClass(name = '3b') {
  await act(async () => {
    fireEvent.change(screen.getByLabelText(/Class name/), { target: { value: name } });
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create class' }));
}

describe('class created dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.create.mockResolvedValue(CREATED);
  });

  it('keeps the invite code on screen after the page switches away from the form', async () => {
    const view = render(<Page hasClass={false} />);
    await createClass();

    const dialog = await screen.findByRole('dialog', { name: 'Class 3b is ready' });
    expect(within(dialog).getByText('ACDE-FHJK')).toBeVisible();
    expect(router.refresh).toHaveBeenCalled();

    // What the refresh does: the class exists now, so the first-class form is replaced.
    view.rerender(<Page hasClass />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Class 3b is ready' })).toBeVisible();
    expect(screen.getByText('ACDE-FHJK')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('copies the code and says so', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<Page hasClass={false} />);
    await createClass();
    fireEvent.click(await screen.findByRole('button', { name: 'Copy code' }));
    await waitFor(() => {
      expect(screen.getAllByRole('status').some((s) => s.textContent === 'Copied.')).toBe(true);
    });
    expect(writeText).toHaveBeenCalledWith('ACDE-FHJK');
  });

  it('adds another class from the dialog beside the class selector', async () => {
    render(
      withI18n(
        <ClassroomCreationProvider>
          <AddClassroomDialog />
        </ClassroomCreationProvider>,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add class' }));
    expect(screen.getByRole('dialog', { name: 'New class' })).toBeVisible();
    await createClass('4a');

    expect(await screen.findByRole('dialog', { name: 'Class 3b is ready' })).toBeVisible();
    expect(screen.queryByRole('dialog', { name: 'New class' })).not.toBeInTheDocument();
  });
});

describe('class form input (#124)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.create.mockResolvedValue(CREATED);
  });

  function typeInto(label: RegExp, value: string) {
    return act(async () => {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    });
  }

  it('stops the class name at a grade and one letter', () => {
    render(<Page hasClass={false} />);
    expect(screen.getByLabelText(/Class name/)).toHaveAttribute('maxlength', '2');
  });

  it.each(['99', '5a', 'xy'])(
    'refuses the name %j with a message and sends nothing',
    async (name) => {
      render(<Page hasClass={false} />);
      await typeInto(/Class name/, name);
      fireEvent.click(screen.getByRole('button', { name: 'Create class' }));

      expect(await screen.findByText(/digit from 1 to 4 followed by one letter/)).toBeVisible();
      expect(actions.create).not.toHaveBeenCalled();
    },
  );

  it.each(['5', '0', '99', '2.5'])(
    'refuses the grade %s with a message and sends nothing',
    async (grade) => {
      render(<Page hasClass={false} />);
      await typeInto(/Class name/, '3b');
      await typeInto(/Grade/, grade);
      fireEvent.click(screen.getByRole('button', { name: 'Create class' }));

      expect(await screen.findByText('Enter a grade from 1 to 4.')).toBeVisible();
      expect(actions.create).not.toHaveBeenCalled();
    },
  );

  it('sends the name in lower case', async () => {
    render(<Page hasClass={false} />);
    await typeInto(/Class name/, '3B');
    await typeInto(/Grade/, '3');
    fireEvent.click(screen.getByRole('button', { name: 'Create class' }));

    await waitFor(() => {
      expect(actions.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: '3b', grade: 3 }),
      );
    });
  });
});

describe('invite code in the class details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.regenerate.mockResolvedValue({
      ok: true,
      data: { classroom: { id: 'class-1' }, inviteCode: 'MNPR-TUVW' },
    });
  });

  function renderSection(inviteCode: string | null) {
    return render(
      withI18n(
        <InviteCodeSection
          classroomId="class-1"
          inviteCode={inviteCode}
          expiresAt={new Date('2026-11-07T12:00:00Z')}
          isExpired={false}
        />,
      ),
    );
  }

  it('shows a hash-only code as unavailable and never replaces it without confirmation', async () => {
    renderSection(null);
    expect(screen.getByText('Code unavailable')).toBeVisible();
    expect(actions.regenerate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Generate new code' }));
    expect(screen.getByRole('alert')).toHaveTextContent('The current code stops working at once');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(actions.regenerate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Generate new code' }));
    fireEvent.click(
      within(screen.getByRole('alert')).getByRole('button', { name: 'Generate new code' }),
    );
    expect(await screen.findByText('MNPR-TUVW')).toBeVisible();
    expect(actions.regenerate).toHaveBeenCalledWith({ id: 'class-1' });
  });

  it('shows a stored code with its expiry', () => {
    renderSection('ACDE-FHJK');
    expect(screen.getByText('ACDE-FHJK')).toBeVisible();
    expect(screen.getByText(/Valid until November 7, 2026/)).toBeVisible();
  });
});

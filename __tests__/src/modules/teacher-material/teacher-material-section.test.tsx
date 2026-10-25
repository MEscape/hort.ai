import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MaterialView } from '@modules/teacher-material/application/contracts/material-views';
import { TeacherMaterialSection } from '@modules/teacher-material/presentation/components/teacher-material-section';
import messages from '@modules/teacher-material/presentation/i18n/en.json';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

import type * as I18n from '@i18n';

const refresh = vi.fn();
const actions = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn() }));
vi.mock('@i18n', async (original) => ({
  ...(await original<typeof I18n>()),
  useRouter: () => ({ refresh }),
}));
vi.mock('@modules/teacher-material/presentation/actions/upload-material-action', () => ({
  uploadMaterialAction: actions.upload,
}));
vi.mock('@modules/teacher-material/presentation/actions/delete-material-action', () => ({
  deleteMaterialAction: actions.remove,
}));

const material = (overrides: Partial<MaterialView>): MaterialView => ({
  id: 'material-1',
  classroomId: 'class-1',
  title: 'Zahlen bis 1000',
  contentType: 'text/plain',
  sizeBytes: 41,
  status: 'PROCESSED',
  createdAt: '2026-10-25T08:00:00.000Z',
  ...overrides,
});

function renderSection(materials: readonly MaterialView[] = []) {
  return render(
    <I18nClientProvider locale="en" timeZone="Europe/Berlin" messages={messages} isDevelopment>
      <TeacherMaterialSection classroomId="class-1" materials={materials} />
    </I18nClientProvider>,
  );
}

async function chooseAndUpload(file: File) {
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Choose a file'), { target: { files: [file] } });
  });
  fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
}

describe('teacher material section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.upload.mockResolvedValue({ ok: true, data: { materialId: 'material-1' } });
    actions.remove.mockResolvedValue({ ok: true, data: undefined });
  });

  it('uploads the chosen text file for this class and reloads the list', async () => {
    renderSection();
    const file = new File(['- Zahlen bis 1000'], 'Zahlen.txt', { type: 'text/plain' });
    await chooseAndUpload(file);
    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    const data = actions.upload.mock.calls[0]?.[0] as FormData;
    expect(data.get('classroomId')).toBe('class-1');
    expect((data.get('file') as File).name).toBe('Zahlen.txt');
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('“Zahlen” is uploaded.');
    });
  });

  it('explains a file the server could not read in friendly words', async () => {
    actions.upload.mockResolvedValue({
      ok: false,
      error: { code: 'teacher_material.validation_failed', message: 'invalid' },
    });
    renderSection();
    await chooseAndUpload(new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The file could not be read. Please upload an unencrypted Word or PowerPoint document or a UTF-8 text file.',
    );
  });

  it('refuses a file of another type before uploading', async () => {
    renderSection();
    await chooseAndUpload(new File(['png'], 'photo.png', { type: 'image/png' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Please choose a Word (.docx) or PowerPoint (.pptx) document or a text file (.txt).',
    );
    expect(actions.upload).not.toHaveBeenCalled();
  });

  it.each([
    ['Plan.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['Folien.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    ['Plan.docx', ''],
    ['Folien.PPTX', 'application/octet-stream'],
  ])('accepts the Office file %s (type %j) and uploads it', async (name, type) => {
    renderSection();
    await chooseAndUpload(new File(['PK'], name, { type }));
    await waitFor(() => {
      expect(actions.upload).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('refuses the old binary Office formats and tells how to convert them', async () => {
    renderSection();
    await chooseAndUpload(new File(['x'], 'Plan.doc', { type: 'application/msword' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Save older .doc and .ppt files');
    expect(actions.upload).not.toHaveBeenCalled();
  });

  it('asks for a file when none is chosen', async () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please choose a file first.');
    expect(actions.upload).not.toHaveBeenCalled();
  });

  it('lists each material with its state and a reason for a failed file', () => {
    renderSection([
      material({}),
      material({ id: 'material-2', title: 'Kaputt', status: 'FAILED' }),
      material({ id: 'material-3', title: 'Neu', status: 'UPLOADED', createdAt: null }),
    ]);
    const items = within(screen.getByRole('list', { name: 'Uploaded material' })).getAllByRole(
      'listitem',
    );
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Zahlen bis 1000');
    expect(items[0]).toHaveTextContent('Ready');
    expect(items[0]).toHaveTextContent('Uploaded on');
    expect(items[1]).toHaveTextContent('Failed');
    expect(items[1]).toHaveTextContent('The file could not be read.');
    expect(items[2]).toHaveTextContent('Processing');
  });

  it('shows an empty state without material', () => {
    renderSection();
    expect(screen.getByText('No material in this class yet.')).toBeVisible();
  });

  it('deletes one material by its id and reloads the list', async () => {
    renderSection([material({})]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete “Zahlen bis 1000”' }));
    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
    expect(actions.remove).toHaveBeenCalledWith({ id: 'material-1' });
    expect(screen.getByRole('status')).toHaveTextContent('“Zahlen bis 1000” is deleted.');
  });
});

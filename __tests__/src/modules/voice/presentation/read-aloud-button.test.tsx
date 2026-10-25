import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readAloudAction } from '@modules/voice/presentation/actions/read-aloud-action';
import { ReadAloudButton } from '@modules/voice/presentation/components/read-aloud-button';

vi.mock('@i18n/client', () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      'readAloud.play': 'Read aloud',
      'readAloud.stop': 'Stop',
      'readAloud.loading': 'Just a moment …',
      'readAloud.problem.consent_required': "Your parents haven't switched on reading aloud yet.",
      'readAloud.problem.busy': "Take a short break, then I'll read to you again.",
      'readAloud.problem.failed': "Reading aloud didn't work just now.",
    };
    return messages[key] ?? key;
  },
}));

vi.mock('@modules/voice/presentation/actions/read-aloud-action', () => ({
  readAloudAction: vi.fn(),
}));

class FakeAudio {
  static instances: FakeAudio[] = [];
  currentTime = 0;
  src = '';
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn(async () => undefined);
  pause = vi.fn();

  constructor() {
    FakeAudio.instances.push(this);
  }
}

const childProfileId = 'child-42';
const message = { id: 'message-7' } as never;
const action = vi.mocked(readAloudAction);
const fetchMock = vi.fn();
const createObjectURL = vi.fn(() => 'blob:voice-audio');
const revokeObjectURL = vi.fn();

function setup(allowed = true) {
  return render(
    <ReadAloudButton childProfileId={childProfileId} message={message} allowed={allowed} />,
  );
}

function actionSuccess() {
  action.mockResolvedValue({
    ok: true,
    data: { ticket: 'signed-ticket', speakerId: 'speaker-9' },
  });
}

function lastAudio() {
  const audio = FakeAudio.instances.at(-1);
  if (audio === undefined) {
    throw new Error('no audio element was created');
  }
  return audio;
}

describe('ReadAloudButton', () => {
  beforeEach(() => {
    action.mockReset();
    fetchMock.mockReset();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    FakeAudio.instances = [];
    vi.stubGlobal('Audio', FakeAudio);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is not rendered when voice reading is not allowed', () => {
    setup(false);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('gets a ticket, requests audio without message text, plays it and reuses cached audio', async () => {
    actionSuccess();
    fetchMock.mockResolvedValue({ ok: true, blob: async () => new Blob(['audio']) });
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Read aloud' }));

    await waitFor(() => {
      expect(lastAudio().play).toHaveBeenCalledOnce();
    });
    expect(action).toHaveBeenCalledWith({ childProfileId, message });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/voice/speech');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options.body as string)).toEqual({
      speakerId: 'speaker-9',
      ticket: 'signed-ticket',
      childProfileId,
    });
    expect(JSON.parse(options.body as string)).not.toHaveProperty('text');
    expect(lastAudio().src).toBe('blob:voice-audio');
    expect(screen.getByRole('button', { name: 'Stop' })).toHaveAttribute('aria-pressed', 'true');

    act(() => lastAudio().onended?.());
    fireEvent.click(screen.getByRole('button', { name: 'Read aloud' }));

    await waitFor(() => {
      expect(lastAudio().play).toHaveBeenCalledTimes(2);
    });
    expect(action).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(FakeAudio.instances).toHaveLength(1);
  });

  it('stops playback on a second press', async () => {
    actionSuccess();
    fetchMock.mockResolvedValue({ ok: true, blob: async () => new Blob(['audio']) });
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Read aloud' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop' })).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

    expect(lastAudio().pause).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Read aloud' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('shows the consent problem from the server action', async () => {
    action.mockResolvedValue({
      ok: false,
      error: { code: 'voice.consent_required' },
    } as Awaited<ReturnType<typeof readAloudAction>>);
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Read aloud' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      "Your parents haven't switched on reading aloud yet.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the busy problem for a rate-limited speech response', async () => {
    actionSuccess();
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ code: 'voice.rate_limited' }) });
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Read aloud' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      "Take a short break, then I'll read to you again.",
    );
  });
});

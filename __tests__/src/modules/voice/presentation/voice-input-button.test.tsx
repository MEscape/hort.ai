import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VoiceInputButton } from '@modules/voice/presentation/components/voice-input-button';

vi.mock('@i18n/client', () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      'input.start': 'Speak',
      'input.stop': 'Done',
      'input.listening': "I'm listening …",
      'input.transcribing': "I'm writing down what you said …",
      'input.hint': 'Tap the microphone and speak.',
      'input.notAllowed': "Your parents haven't switched on speaking yet. Just type.",
      'input.problem.mic_denied': 'Hort may not listen right now. No problem, just type.',
      'input.problem.unsupported': "Speaking doesn't work on this device. Just type.",
      'input.problem.nothing_heard': "I didn't hear anything. Try again, close to the microphone.",
      'input.problem.consent_required': "Your parents haven't switched on speaking yet. Just type.",
      'input.problem.busy': 'Take a short break and try again in a moment.',
      'input.problem.failed': "That didn't work just now. Try again or type.",
    };
    return messages[key] ?? key;
  },
}));

class FakeMediaRecorder {
  static isTypeSupported = vi.fn(() => true);
  static instance: FakeMediaRecorder | null = null;
  static nextChunk = new Blob(['recording'], { type: 'audio/webm' });
  state: RecordingState = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  stream: MediaStream;

  constructor(stream: MediaStream) {
    this.stream = stream;
    FakeMediaRecorder.instance = this;
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: FakeMediaRecorder.nextChunk } as BlobEvent);
    this.onstop?.();
  }
}

const trackStop = vi.fn();
const onTranscript = vi.fn();
const childProfileId = 'child-42';

function setup(allowed = true) {
  return render(
    <VoiceInputButton
      childProfileId={childProfileId}
      allowed={allowed}
      onTranscript={onTranscript}
    />,
  );
}

async function startRecording() {
  fireEvent.click(screen.getByRole('button', { name: 'Speak' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled());
}

async function stopRecording() {
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
}

describe('VoiceInputButton', () => {
  beforeEach(() => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    vi.stubGlobal('fetch', vi.fn());
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: trackStop }] })) },
    });
    FakeMediaRecorder.nextChunk = new Blob(['recording'], { type: 'audio/webm' });
    FakeMediaRecorder.instance = null;
    trackStop.mockClear();
    onTranscript.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the recorded audio and child id, then delivers the trimmed transcript', async () => {
    const fetchMock = vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ text: '  Hello there!  ' }),
    } as Response);
    setup();

    await startRecording();
    await stopRecording();

    await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('Hello there!'));
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/voice/transcription');
    expect(options.method).toBe('POST');
    const form = options.body as FormData;
    expect(form.get('childProfileId')).toBe(childProfileId);
    expect(form.get('audio')).toBeInstanceOf(Blob);
    expect((form.get('audio') as Blob).type).toBe('audio/webm');
    expect(trackStop).toHaveBeenCalledOnce();
  });

  it('shows mic_denied and does not fetch when microphone permission is refused', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')),
      },
    });
    const fetchMock = vi.mocked(fetch);
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Speak' }));

    expect(
      await screen.findByText('Hort may not listen right now. No problem, just type.'),
    ).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows unsupported when MediaRecorder is unavailable', async () => {
    vi.stubGlobal('MediaRecorder', undefined);
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Speak' }));

    expect(
      await screen.findByText("Speaking doesn't work on this device. Just type."),
    ).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the consent problem returned by the transcription endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ code: 'voice.consent_required' }),
    } as Response);
    setup();

    await startRecording();
    await stopRecording();

    expect(
      await screen.findByText("Your parents haven't switched on speaking yet. Just type."),
    ).toBeVisible();
  });

  it('shows nothing_heard for an empty recording', async () => {
    FakeMediaRecorder.nextChunk = new Blob([]);
    setup();

    await startRecording();
    await stopRecording();

    expect(
      await screen.findByText("I didn't hear anything. Try again, close to the microphone."),
    ).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('disables the microphone and explains when voice input is not allowed', () => {
    setup(false);

    expect(screen.getByRole('button', { name: 'Speak' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      "Your parents haven't switched on speaking yet. Just type.",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});

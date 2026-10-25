import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';


import {
  resetSpokenLineCache,
  useSpokenLine,
} from '@modules/voice/presentation/components/use-spoken-line';

import { FakeAudio, stubAudio } from '../../../components/shared/fake-audio';

import type { Mock } from 'vitest';

const clip = () => new Response(new Blob(['mp3'], { type: 'audio/mpeg' }), { status: 200 });

let fetchMock: Mock<typeof fetch>;

beforeEach(() => {
  stubAudio();
  resetSpokenLineCache();
  fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(clip()));
  vi.stubGlobal('fetch', fetchMock);
  let n = 0;
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => `blob:clip-${++n}`,
    revokeObjectURL: vi.fn(),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const speak = async (hook: { speak: (line: 'hello') => Promise<void> }) => {
  await act(async () => {
    await hook.speak('hello');
  });
};

describe('useSpokenLine', () => {
  it('asks the voice endpoint for a fixed line of the speaker, naming it and never sending words', async () => {
    const { result } = renderHook(() => useSpokenLine({ speakerId: 'lili', isAllowed: true }));
    await speak(result.current);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/voice/speech', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ speakerId: 'lili', phrase: 'hello' }),
    });
    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0]?.play).toHaveBeenCalledOnce();
  });

  it('stays silent, with no request at all, when sound is not allowed', async () => {
    const { result } = renderHook(() => useSpokenLine({ speakerId: 'lili', isAllowed: false }));
    await speak(result.current);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it('fetches a line once and plays it again from memory', async () => {
    const { result } = renderHook(() => useSpokenLine({ speakerId: 'lili', isAllowed: true }));
    await speak(result.current);
    await speak(result.current);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(FakeAudio.instances).toHaveLength(2);
  });

  it('keeps one voice at a time: a new line stops the one that is playing', async () => {
    const { result } = renderHook(() => useSpokenLine({ speakerId: 'lili', isAllowed: true }));
    await speak(result.current);
    await act(async () => {
      await result.current.speak('photoSoon');
    });
    expect(FakeAudio.instances[0]?.pause).toHaveBeenCalled();
    expect(FakeAudio.instances[1]?.play).toHaveBeenCalled();
  });

  it('drops a line that arrives after a newer one was asked for', async () => {
    let release: (response: Response) => void = () => undefined;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (release = resolve)));
    const { result } = renderHook(() => useSpokenLine({ speakerId: 'lili', isAllowed: true }));
    let late: Promise<void> = Promise.resolve();
    act(() => {
      late = result.current.speak('hello');
    });
    await act(async () => {
      await result.current.speak('photoSoon');
    });
    await act(async () => {
      release(clip());
      await late;
    });
    expect(FakeAudio.instances).toHaveLength(1);
  });

  it('falls back to text without an error when the endpoint refuses, and tries again next time', async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(new Response('{}', { status: 429 })));
    const { result } = renderHook(() => useSpokenLine({ speakerId: 'lili', isAllowed: true }));
    await speak(result.current);
    expect(FakeAudio.instances).toHaveLength(0);
    await speak(result.current);
    expect(FakeAudio.instances).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to text when the network is down', async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    const { result } = renderHook(() => useSpokenLine({ speakerId: 'lili', isAllowed: true }));
    await expect(speak(result.current)).resolves.toBeUndefined();
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it('is quiet when the browser blocks sound before the first tap', async () => {
    FakeAudio.nextPlay = () => Promise.reject(new DOMException('blocked', 'NotAllowedError'));
    const { result } = renderHook(() => useSpokenLine({ speakerId: 'lili', isAllowed: true }));
    await expect(speak(result.current)).resolves.toBeUndefined();
  });

  it('stops on request and when the screen is left', async () => {
    const { result, unmount } = renderHook(() =>
      useSpokenLine({ speakerId: 'lili', isAllowed: true }),
    );
    await speak(result.current);
    act(() => {
      result.current.stop();
    });
    expect(FakeAudio.instances[0]?.pause).toHaveBeenCalled();
    await speak(result.current);
    unmount();
    expect(FakeAudio.instances[1]?.pause).toHaveBeenCalled();
  });
});

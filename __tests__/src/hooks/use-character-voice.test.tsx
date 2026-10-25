import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCharacterVoice } from '@hooks/use-character-voice';

import { FakeAudio, soundsPlaying, stubAudio } from '../components/shared/fake-audio';

const A = 'https://storage.test/a.mp3';
const B = 'https://storage.test/b.mp3';

function last(): FakeAudio {
  const audio = FakeAudio.instances.at(-1);
  if (audio === undefined) {
    throw new Error('no audio element was created');
  }
  return audio;
}

describe('useCharacterVoice', () => {
  beforeEach(stubAudio);
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates nothing until the first press', () => {
    renderHook(() => useCharacterVoice(A));
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it('plays after a press, is buffering until the sound runs, and stops on the second press', () => {
    const { result } = renderHook(() => useCharacterVoice(A));
    act(() => {
      result.current.toggle();
    });
    expect(result.current).toMatchObject({ status: 'playing', isBuffering: true });
    act(() => {
      last().onplaying?.();
    });
    expect(result.current.isBuffering).toBe(false);
    act(() => {
      last().onwaiting?.();
    });
    expect(result.current.isBuffering).toBe(true);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.status).toBe('idle');
    expect(last().pause).toHaveBeenCalled();
    expect(soundsPlaying()).toBe(0);
  });

  it('reports the fraction played only when asked to, in whole percent', () => {
    const quiet = renderHook(() => useCharacterVoice(A));
    act(() => {
      quiet.result.current.toggle();
    });
    expect(last().ontimeupdate).toBeNull();
    quiet.unmount();

    const { result } = renderHook(() => useCharacterVoice(A, { trackProgress: true }));
    act(() => {
      result.current.toggle();
    });
    last().currentTime = 2.504;
    act(() => {
      last().ontimeupdate?.();
    });
    expect(result.current.progress).toBe(0.25);
    last().duration = Number.NaN;
    act(() => {
      last().ontimeupdate?.();
    });
    expect(result.current.progress).toBe(0);
  });

  it('is idle again when the sound ends', () => {
    const { result } = renderHook(() => useCharacterVoice(A));
    act(() => {
      result.current.toggle();
    });
    act(() => {
      last().onended?.();
    });
    expect(result.current).toMatchObject({ status: 'idle', progress: 0, isBuffering: false });
  });

  it('is unavailable without an address and never creates audio', () => {
    const { result } = renderHook(() => useCharacterVoice(''));
    act(() => {
      result.current.toggle();
    });
    expect(result.current.status).toBe('unavailable');
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it('is unavailable after an error or a refused play, and a new press starts a fresh element', async () => {
    const { result } = renderHook(() => useCharacterVoice(A));
    act(() => {
      result.current.toggle();
    });
    act(() => {
      last().onerror?.();
    });
    expect(result.current.status).toBe('unavailable');

    FakeAudio.nextPlay = () => Promise.reject(new Error('blocked'));
    await act(async () => {
      result.current.toggle();
      await Promise.resolve();
    });
    expect(FakeAudio.instances).toHaveLength(2);
    expect(result.current.status).toBe('unavailable');
  });

  it('does not call it a failure when stopping interrupts a sound that is still loading', async () => {
    FakeAudio.nextPlay = () => Promise.reject(new DOMException('interrupted', 'AbortError'));
    const { result } = renderHook(() => useCharacterVoice(A));
    await act(async () => {
      result.current.toggle();
      await Promise.resolve();
    });
    expect(result.current.status).toBe('playing');
  });

  it('stops the old sound when the address changes and starts the new one from idle, one at a time', () => {
    const { result, rerender } = renderHook(({ url }) => useCharacterVoice(url), {
      initialProps: { url: A },
    });
    act(() => {
      result.current.toggle();
    });
    const first = last();
    rerender({ url: B });
    expect(first.pause).toHaveBeenCalled();
    expect(result.current.status).toBe('idle');

    act(() => {
      result.current.toggle();
    });
    expect(last().url).toBe(B);
    expect(soundsPlaying()).toBe(1);
  });

  it('stops the sound when the screen is left', () => {
    const { result, unmount } = renderHook(() => useCharacterVoice(A));
    act(() => {
      result.current.toggle();
    });
    const element = last();
    unmount();
    expect(element.pause).toHaveBeenCalled();
    expect(soundsPlaying()).toBe(0);
  });
});

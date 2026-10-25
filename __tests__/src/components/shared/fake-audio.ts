import { vi } from 'vitest';

/** A stand-in for the browser's `Audio`: nothing plays, the test fires the element's events itself. */
export class FakeAudio {
  static instances: FakeAudio[] = [];
  /** What the next `play()` does; a test sets it to reject. */
  static nextPlay: () => Promise<void> = () => Promise.resolve();

  currentTime = 0;
  duration = 10;
  isPlaying = false;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onplaying: (() => void) | null = null;
  onwaiting: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeAudio.instances.push(this);
  }

  play = vi.fn(() => {
    this.isPlaying = true;
    return FakeAudio.nextPlay();
  });

  pause = vi.fn(() => {
    this.isPlaying = false;
  });
}

export function stubAudio(): void {
  FakeAudio.instances = [];
  FakeAudio.nextPlay = () => Promise.resolve();
  vi.stubGlobal('Audio', FakeAudio);
}

/** How many fake elements are making a sound right now: it must never be more than one. */
export function soundsPlaying(): number {
  return FakeAudio.instances.filter((audio) => audio.isPlaying).length;
}

export function stubMotion(isReduced: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: isReduced,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

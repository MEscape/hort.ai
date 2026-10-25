const STORAGE_KEY = 'hortai.home.greeting';

export interface GreetingMemory {
  readonly line: string;
  /** When it was said, in epoch milliseconds of the server-based clock. */
  readonly at: number;
}

function isGreetingMemory(value: unknown): value is GreetingMemory {
  return (
    typeof value === 'object' &&
    value !== null &&
    'line' in value &&
    typeof value.line === 'string' &&
    'at' in value &&
    typeof value.at === 'number'
  );
}

/**
 * What was said last, kept for this browser tab only: a convenience that stops the same line (or a
 * refresh loop) from greeting twice. Storage can be blocked or empty; then nothing is remembered.
 */
export function readGreetingMemory(): GreetingMemory | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    return isGreetingMemory(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeGreetingMemory(memory: GreetingMemory): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Blocked storage only costs the "no repeat" convenience.
  }
}

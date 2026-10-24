/**
 * Async helpers. Zero dependencies, no knowledge of what they wrap.
 */

/** Thrown by `withTimeout`; `timeoutMs` is the limit that was exceeded. */
export class TimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Rejects with `TimeoutError` if the promise does not settle within `timeoutMs`. It cannot cancel
 * the underlying work, so pair it with an `AbortSignal` when cancellation matters: the abandoned
 * promise keeps running, and a later rejection of it is swallowed rather than reported as
 * unhandled. The timer is always cleared, so a settled call leaves nothing pending.
 *
 * @throws TimeoutError when the limit passes first; otherwise whatever the promise throws
 * @example await withTimeout(store.hit(key), 1500);
 */
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(timeoutMs));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolves after `ms` milliseconds. Not cancellable: it is for pauses between retries, where
 * finishing the pause is harmless. Use an `AbortSignal` when the wait itself must be abortable.
 *
 * @example await sleep(200 * 2 ** attempt);
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

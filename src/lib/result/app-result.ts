import { err, errAsync, ok, okAsync, Result, ResultAsync } from 'neverthrow';

import type { AppError } from '@lib/errors';

/**
 * Canonical Result alias used across domain/application/infrastructure.
 * Per errors.md: Result for recoverable business/application errors,
 * ResultAsync for asynchronous operations that can fail predictably.
 */
export type AppResult<T, E extends AppError = AppError> = Result<T, E>;
export type AppResultAsync<T, E extends AppError = AppError> = ResultAsync<T, E>;

export { err, errAsync, ok, okAsync, Result, ResultAsync };

/**
 * Wraps a throwing function into a Result, converting the thrown value
 * into an AppError via the supplied mapper. Use at infrastructure edges
 * where a third-party call is the only thing that can throw
 * (errors.md: "reserve throw for unexpected programmer or system failures").
 */
export function fromThrowable<T, E extends AppError>(
  fn: () => T,
  onError: (thrown: unknown) => E,
): AppResult<T, E> {
  try {
    return ok(fn());
  } catch (thrown) {
    return err(onError(thrown));
  }
}

/**
 * Async counterpart of `fromThrowable`. `fn` is invoked inside a `try` so
 * that a function which throws synchronously — before it ever produces the
 * promise it's typed to return — is caught here rather than escaping the
 * `Result` wrapper entirely. `ResultAsync.fromPromise` alone cannot catch
 * that case, since there is no promise yet for it to attach to.
 */
export function fromThrowableAsync<T, E extends AppError>(
  fn: () => Promise<T>,
  onError: (thrown: unknown) => E,
): AppResultAsync<T, E> {
  try {
    return ResultAsync.fromPromise(fn(), onError);
  } catch (thrown) {
    return errAsync(onError(thrown));
  }
}

/**
 * Combine multiple independent Results into one, short-circuiting on the
 * first failure. Thin re-export kept here so call sites only ever import
 * from `@lib/result`, never reach into `neverthrow` directly.
 */
export const combine = Result.combine.bind(Result);
export const combineAsync = ResultAsync.combine.bind(ResultAsync);

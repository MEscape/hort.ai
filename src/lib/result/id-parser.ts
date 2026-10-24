import type { AppError } from '@lib/errors';
import { unique } from '@lib/utils';

import { err, ok } from './app-result';

import type { AppResult } from './app-result';

export interface IdParserConfig<T, E extends AppError> {
  readonly isValid: (raw: string) => boolean;
  readonly brand: (raw: string) => T;
  readonly mapError: () => E;
}

export function createIdParser<T, E extends AppError>(config: IdParserConfig<T, E>) {
  return (raw: string): AppResult<T, E> =>
    config.isValid(raw) ? ok(config.brand(raw)) : err(config.mapError());
}

/**
 * The ids of a lookup by id: those that parse, each once, at most `limit`.
 * A malformed id cannot name anything, so it is dropped rather than failing
 * the whole lookup.
 */
export function parseValidIds<T>(
  raw: readonly string[],
  parse: (raw: string) => AppResult<T>,
  limit: number,
): T[] {
  return unique(raw)
    .slice(0, limit)
    .flatMap((id) =>
      parse(id).match(
        (parsed): T[] => [parsed],
        () => [],
      ),
    );
}

/**
 * The public surface of `@lib/utils`: pure, dependency-free helpers, one file per concern, listed
 * here in the same (alphabetical) order as the files. Import from `@lib/utils`, not from a file.
 * A helper used only inside its own file stays out of this list.
 */

export { assertNever, invariant } from './assert';

export {
  groupBy,
  insertItem,
  isDefined,
  keyBy,
  literalGuard,
  range,
  removeAt,
  replaceAt,
  unique,
} from './array';

export { sleep, TimeoutError, withTimeout } from './async';

export { type Brand } from './brand';

export { cn } from './cn';

export {
  addDays,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  MS_PER_DAY,
  MS_PER_MINUTE,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
  type DateInput,
} from './date';

export { debounce, identity, noop, once } from './function';

export {
  JsonParseError,
  JsonStringifyError,
  parseJson,
  stableStringify,
  stringifyJson,
  type JsonPrimitive,
  type JsonValue,
} from './json';

export { isJsonRecord, isJsonValue, jsonWeight } from './json-value';

export {
  BUILD_RETRY_INTERVAL_MS,
  createLazyCell,
  resolveLazy,
  type LazyCell,
  type LazyFailure,
  type LazyResult,
  type ResolveLazyDeps,
} from './lazy-cell';

export { clamp, formatBytes, formatMoney, formatNumber, formatPercent } from './number';

export {
  changedKeys,
  deepEqual,
  deepMerge,
  definedKeys,
  hasOwnKey,
  isPlainObject,
  omit,
  pick,
} from './object';

export {
  getPath,
  hasUnsafePathSegment,
  isUnsafePathSegment,
  normalizePath,
  pathSegments,
  setPath,
} from './path';

export {
  arrayOf,
  isBoolean,
  isFiniteNumber,
  isInteger,
  isString,
  nullable,
  objectOf,
  oneOf,
  optional,
  type Guard,
} from './shape';

export { escapeHtml, isBlank, slugify, stripHtml, trimToNull, truncate } from './string';

export {
  countNodes,
  findPathInForest,
  flattenForest,
  locateInForest,
  mapTree,
  removeFromForest,
  updateForest,
  type ForestEntry,
  type ForestLocation,
  type GetChildren,
  type TreeShape,
  type WithChildren,
} from './tree';

export { buildQueryString, isRelativePath, isValidUrl, joinPath, stripTrailingSlash } from './url';

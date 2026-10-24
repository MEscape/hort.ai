import { describe, expect, it } from 'vitest';

import * as utils from '@lib/utils';

describe('@lib/utils barrel', () => {
  it('exposes every documented runtime export', () => {
    const functions = [
      'assertNever',
      'invariant',
      'groupBy',
      'insertItem',
      'isDefined',
      'keyBy',
      'literalGuard',
      'range',
      'removeAt',
      'replaceAt',
      'unique',
      'sleep',
      'withTimeout',
      'cn',
      'addDays',
      'formatDate',
      'formatDateTime',
      'formatRelativeTime',
      'debounce',
      'identity',
      'noop',
      'once',
      'parseJson',
      'stableStringify',
      'stringifyJson',
      'isJsonRecord',
      'isJsonValue',
      'jsonWeight',
      'createLazyCell',
      'resolveLazy',
      'clamp',
      'formatBytes',
      'formatMoney',
      'formatNumber',
      'formatPercent',
      'changedKeys',
      'deepEqual',
      'deepMerge',
      'definedKeys',
      'hasOwnKey',
      'isPlainObject',
      'omit',
      'pick',
      'getPath',
      'hasUnsafePathSegment',
      'isUnsafePathSegment',
      'normalizePath',
      'pathSegments',
      'setPath',
      'arrayOf',
      'isBoolean',
      'isFiniteNumber',
      'isInteger',
      'isString',
      'nullable',
      'objectOf',
      'oneOf',
      'optional',
      'escapeHtml',
      'isBlank',
      'slugify',
      'stripHtml',
      'trimToNull',
      'truncate',
      'countNodes',
      'findPathInForest',
      'flattenForest',
      'locateInForest',
      'mapTree',
      'removeFromForest',
      'updateForest',
      'buildQueryString',
      'isRelativePath',
      'isValidUrl',
      'joinPath',
      'stripTrailingSlash',
    ];
    const values = utils as Record<string, unknown>;

    for (const name of functions) {
      expect(values[name], name).toBeTypeOf('function');
    }
  });

  it('exposes the documented constants and error classes', () => {
    expect(utils.BUILD_RETRY_INTERVAL_MS).toBeTypeOf('number');
    expect(utils.MS_PER_DAY).toBeTypeOf('number');
    expect(utils.MS_PER_MINUTE).toBeTypeOf('number');
    expect(utils.SECONDS_PER_HOUR).toBeTypeOf('number');
    expect(utils.SECONDS_PER_MINUTE).toBeTypeOf('number');
    expect(new utils.TimeoutError(1)).toBeInstanceOf(Error);
    expect(utils.JsonParseError.prototype).toBeInstanceOf(Error);
    expect(utils.JsonStringifyError.prototype).toBeInstanceOf(Error);
  });
});

/**
 * URL and path helpers. Zero dependencies.
 *
 * The functions that judge a URL (`isValidUrl`, `isRelativePath`) decide what may be stored and
 * rendered as a link, so they are strict: anything they do not positively recognise is refused.
 */

const PLACEHOLDER_ORIGIN = 'http://relative.invalid';

/**
 * True when the string parses as an absolute URL whose protocol is on the allowlist (`http:` and
 * `https:` by default). Use it before storing or rendering a link from untrusted input: it refuses
 * `javascript:`, `data:` and anything that is not a URL.
 *
 * @example isValidUrl('https://example.org') // true
 * @example isValidUrl('javascript:alert(1)') // false
 */
export function isValidUrl(
  value: string,
  protocols: readonly string[] = ['http:', 'https:'],
): boolean {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/**
 * True for same-origin paths such as `/news`; false for absolute or protocol-relative URLs. Guards
 * open redirects. The text is resolved the way a browser would: browsers drop tabs and line breaks
 * from a URL, so `"/\t/evil.com"` is `//evil.com` there, however harmless it looks as a string.
 *
 * @example isRelativePath('/news?page=2') // true
 * @example isRelativePath('//evil.com') // false
 */
export function isRelativePath(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return false;
  }
  // A single leading slash always resolves against the base; the origin check catches nothing else.
  return new URL(value, PLACEHOLDER_ORIGIN).origin === PLACEHOLDER_ORIGIN;
}

/**
 * Removes any trailing slashes. A scan from the end, not a pattern: a regex for "slashes, then the
 * end" is quadratic on a long run of slashes inside the string.
 *
 * @example stripTrailingSlash('/a//') // '/a'
 */
export function stripTrailingSlash(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') {
    end -= 1;
  }
  return value.slice(0, end);
}

/** Removes the slashes at the start. */
function trimStartSlashes(value: string): string {
  let start = 0;
  while (start < value.length && value[start] === '/') {
    start += 1;
  }
  return value.slice(start);
}

/**
 * Joins URL path segments with single slashes into an absolute path, ignoring empty segments.
 * Does not encode: pass already-encoded segments, and never an untrusted one without checking it
 * (a segment of `..` is kept as it is).
 *
 * @example joinPath('/a/', '/b', '', 'c/') // '/a/b/c'
 */
export function joinPath(...segments: readonly string[]): string {
  const cleaned = segments
    .map((segment) => stripTrailingSlash(trimStartSlashes(segment)))
    .filter((segment) => segment.length > 0);
  return `/${cleaned.join('/')}`;
}

/** A query value that will be included; arrays repeat the key once per item. */
type QueryValue =
  string | number | boolean | null | undefined | ReadonlyArray<string | number | boolean>;

/**
 * Builds a query string, with its leading `?`, from the defined values only (`undefined` and
 * `null` are skipped; array values repeat the key). Keys and values are percent-encoded. Empty
 * when nothing remains.
 *
 * @example buildQueryString({ page: 2, tag: ['a', 'b'], q: undefined }) // '?page=2&tag=a&tag=b'
 */
export function buildQueryString(params: Readonly<Record<string, QueryValue>>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        search.append(key, String(item));
      }
    } else {
      search.append(key, String(value));
    }
  }
  const query = search.toString();
  return query.length > 0 ? `?${query}` : '';
}

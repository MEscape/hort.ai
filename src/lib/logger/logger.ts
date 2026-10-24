import 'server-only';

import { serverEnv } from '@lib/config/server';
import { isPlainObject } from '@lib/utils';

/**
 * Structured logging abstraction (observability.md: "use structured
 * logging", "do not use console.log for application observability").
 *
 * This wraps the actual sink so the rest of the app depends on this
 * interface, not a specific logging vendor — swapping Pino/Datadog/etc.
 * later means editing this file only, same pattern as the data-provider
 * swap described in modules.md for infrastructure.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  /** Correlation/request id — observability.md: "include request/correlation identifiers where available". */
  requestId?: string;
  userId?: string;
  module?: string;
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext | undefined;
  error?: { name: string; message: string; stack?: string | undefined };
}

/**
 * Ordering used to compare the configured minimum level against an
 * entry's level. observability.md: "use log levels consistently" — the
 * comparison, not just the four names, is what makes `LOG_LEVEL` actually
 * filter anything.
 */
const LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * The minimum level this process emits, read once from `serverEnv`
 * (configuration.md: centralize environment access) rather than branching
 * on `NODE_ENV` at each call site. A call below this level is dropped
 * before it reaches the sink, so callers (e.g. the Prisma query logger)
 * can unconditionally log at `debug` and rely on this to decide whether
 * that ever becomes visible output — set `LOG_LEVEL=debug` locally for
 * full per-query detail, `LOG_LEVEL=warn` (or higher) in production to
 * surface only slow/failed queries and above.
 */
const minSeverity = LEVEL_SEVERITY[serverEnv.LOG_LEVEL];

function isEnabled(level: LogLevel): boolean {
  return LEVEL_SEVERITY[level] >= minSeverity;
}

/**
 * Keys that must never appear in a log line, redacted regardless of
 * nesting depth. security.md / observability.md: "never log credentials,
 * tokens, session secrets, or sensitive personal data."
 *
 * A key is redacted when it CONTAINS one of these words, in any casing:
 * `accessToken`, `x-api-key`, `newPassword`, `Set-Cookie` and `AUTH_SECRET`
 * carry credentials as surely as `token` does, and an exact-name list lets
 * every spelling it did not foresee through. Over-redacting a harmless key
 * costs a log field; under-redacting leaks a credential.
 */
const REDACTED_KEY_PATTERN =
  /pass(?:word|wd|phrase)|token|secret|api[-_]?key|private[-_]?key|authorization|cookie|credit[-_]?card|cvv/i;

/** Deeper than any log context is meant to be; bounds the recursion on hostile or accidental nesting. */
const MAX_REDACTION_DEPTH = 8;

/**
 * Opaque: keep it recognizable in the log line without pretending to
 * redact fields inside it. Errors are handled separately via the
 * `error` field on LogEntry, so a bare Error reaching here is already
 * an edge case, not the primary path.
 */
function describeOpaque(value: object): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
  }
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- intentional fallback for opaque objects
  return String(value);
}

/**
 * A copy of `value` that is safe to serialize: sensitive keys redacted, cycles
 * and over-deep nesting cut off, `bigint` as text (`JSON.stringify` throws on it).
 * `ancestors` is the path from the root, not everything seen: an object
 * referenced twice from different places is data, only a reference to one of
 * its own ancestors is a cycle.
 */
function redact(value: unknown, ancestors: readonly object[] = []): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (ancestors.includes(value)) {
    return '[Circular]';
  }
  if (ancestors.length >= MAX_REDACTION_DEPTH) {
    return '[Truncated]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, [...ancestors, value]));
  }

  if (!isPlainObject(value)) {
    return describeOpaque(value);
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    result[key] = REDACTED_KEY_PATTERN.test(key)
      ? '[REDACTED]'
      : redact(val, [...ancestors, value]);
  }
  return result;
}

/**
 * The line for an entry. A context that cannot be serialized (a getter that
 * throws, an object whose `toString` throws) costs only the context: a log call
 * must never throw into the code it observes, least of all from a `catch` block.
 */
function serialize(entry: LogEntry): string {
  try {
    const context = entry.context ? (redact(entry.context) as LogContext) : undefined;
    return JSON.stringify({ ...entry, context });
  } catch {
    return JSON.stringify({ ...entry, context: '[Unserializable]' });
  }
}

function write(entry: LogEntry): void {
  if (!isEnabled(entry.level)) {
    return;
  }

  const line = serialize(entry);

  // The transport is intentionally the only console.* usage in the
  // codebase — everything else must go through `logger`.
  // no-console is disabled for this file at the ESLint config level.
  if (entry.level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  write({ level, message, timestamp: new Date().toISOString(), context });
}

/** `String(value)`, except for a value that cannot be converted (`Object.create(null)`), which must not make a log call throw. */
function printable(value: unknown): string {
  try {
    return String(value);
  } catch {
    return '[unprintable value]';
  }
}

/**
 * An `Error` keeps its stack. An `AppError` is a plain object: its kind and
 * code name it (its `String()` would be "[object Object]"), and an `Error`
 * cause lends its stack.
 */
function normalizeError(error: unknown): {
  name: string;
  message: string;
  stack?: string | undefined;
} {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  if (typeof error === 'object' && error !== null && 'kind' in error && 'code' in error) {
    const { kind, code, cause } = error as { kind: unknown; code: unknown; cause?: unknown };
    return {
      name: String(kind),
      message: String(code),
      ...(cause instanceof Error ? { stack: cause.stack } : {}),
    };
  }
  return { name: 'UnknownError', message: printable(error) };
}

function logError(message: string, error: unknown, context?: LogContext): void {
  const normalized = normalizeError(error);

  write({
    level: 'error',
    message,
    timestamp: new Date().toISOString(),
    context,
    error: normalized,
  });
}

export const logger = {
  debug: (message: string, context?: LogContext): void => {
    log('debug', message, context);
  },
  info: (message: string, context?: LogContext): void => {
    log('info', message, context);
  },
  warn: (message: string, context?: LogContext): void => {
    log('warn', message, context);
  },
  error: logError,
  /** Returns a logger with `context` pre-bound, so a module doesn't repeat itself on every call. */
  withContext(base: LogContext) {
    return {
      debug: (message: string, context?: LogContext): void => {
        log('debug', message, { ...base, ...context });
      },
      info: (message: string, context?: LogContext): void => {
        log('info', message, { ...base, ...context });
      },
      warn: (message: string, context?: LogContext): void => {
        log('warn', message, { ...base, ...context });
      },
      error: (message: string, error: unknown, context?: LogContext): void => {
        logError(message, error, { ...base, ...context });
      },
    };
  },
};

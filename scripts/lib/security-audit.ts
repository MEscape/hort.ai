/** Evaluates `npm audit --json` (report version 2) against reviewed, time-boxed exceptions. */

/** A reviewed advisory that is accepted until `until` (inclusive, UTC calendar date `YYYY-MM-DD`). */
export interface AuditException {
  readonly advisory: string;
  readonly until: string;
  readonly reason: string;
}

export interface AuditVerdict {
  readonly ok: boolean;
  readonly failures: readonly string[];
  readonly notes: readonly string[];
}

interface Advisory {
  readonly id: string;
  readonly severity: string;
  readonly title: string;
}

interface Vulnerability {
  readonly name: string;
  readonly severity: string;
  readonly via: readonly unknown[];
}

const BLOCKING = new Set(['high', 'critical']);
const GHSA = /GHSA(?:-[a-z0-9]{4}){3}/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readVulnerabilities(report: unknown): Map<string, Vulnerability> | undefined {
  if (!isRecord(report) || report['auditReportVersion'] !== 2) {
    return undefined;
  }
  const vulnerabilities = report['vulnerabilities'];
  if (!isRecord(vulnerabilities)) {
    return undefined;
  }
  const result = new Map<string, Vulnerability>();
  for (const [name, entry] of Object.entries(vulnerabilities)) {
    const severity = isRecord(entry) ? entry['severity'] : undefined;
    const via = isRecord(entry) ? entry['via'] : undefined;
    if (typeof severity !== 'string' || !Array.isArray(via)) {
      return undefined;
    }
    result.set(name, { name, severity, via });
  }
  return result;
}

function text(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function toAdvisory(via: Record<string, unknown>): Advisory {
  const url = text(via, 'url') ?? '';
  const id = GHSA.exec(url)?.[0] ?? (url || `npm advisory ${String(via['source'])}`);
  return { id, severity: text(via, 'severity') ?? 'unknown', title: text(via, 'title') ?? '' };
}

/** The advisories a vulnerable package carries itself or inherits through `via` package names. */
function rootAdvisories(
  name: string,
  all: ReadonlyMap<string, Vulnerability>,
  seen = new Set<string>(),
): Advisory[] {
  const entry = all.get(name);
  if (entry === undefined || seen.has(name)) {
    return [];
  }
  seen.add(name);
  return entry.via.flatMap((via) => {
    if (typeof via === 'string') {
      return rootAdvisories(via, all, seen);
    }
    return isRecord(via) ? [toAdvisory(via)] : [];
  });
}

/**
 * Fails on every high or critical finding that is not covered by an unexpired exception, on every
 * expired exception (so it is removed, not forgotten) and on a report it cannot read.
 */
export function evaluateAudit(
  report: unknown,
  exceptions: readonly AuditException[],
  today: string,
): AuditVerdict {
  const vulnerabilities = readVulnerabilities(report);
  if (vulnerabilities === undefined) {
    return { ok: false, failures: ['npm audit returned no readable report'], notes: [] };
  }
  const failures: string[] = [];
  const active = new Map<string, AuditException>();
  for (const exception of exceptions) {
    if (exception.until < today) {
      failures.push(`exception ${exception.advisory} expired on ${exception.until}`);
    } else {
      active.set(exception.advisory.toUpperCase(), exception);
    }
  }
  const used = new Set<string>();
  for (const entry of vulnerabilities.values()) {
    if (!BLOCKING.has(entry.severity)) {
      continue;
    }
    const roots = rootAdvisories(entry.name, vulnerabilities);
    if (roots.length === 0) {
      failures.push(`${entry.name} (${entry.severity}): no advisory found`);
    }
    for (const advisory of roots) {
      const key = advisory.id.toUpperCase();
      if (active.has(key)) {
        used.add(key);
      } else if (BLOCKING.has(advisory.severity) || advisory.severity === 'unknown') {
        failures.push(`${entry.name}: ${advisory.id} (${advisory.severity}) ${advisory.title}`);
      }
    }
  }
  const notes = [...active.values()].map((exception) =>
    used.has(exception.advisory.toUpperCase())
      ? `allowed ${exception.advisory} until ${exception.until}: ${exception.reason}`
      : `exception ${exception.advisory} no longer matches a finding; remove it`,
  );
  return { ok: failures.length === 0, failures: [...new Set(failures)], notes };
}

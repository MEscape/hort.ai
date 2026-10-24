/** A reviewed exception for one advisory, valid through `expires` (inclusive, UTC date). */
export interface AdvisoryException {
  readonly ghsa: string;
  readonly expires: string;
  readonly reason: string;
}

export interface AuditFinding {
  readonly ghsa: string;
  readonly severity: string;
  readonly packageName: string;
  readonly allowed: boolean;
}

const BLOCKING_SEVERITIES = new Set(['high', 'critical']);

/**
 * Applies the exceptions to an `npm audit --json` report: every high or critical advisory blocks unless an
 * unexpired exception names its GHSA. Unknown report shapes throw, so a broken audit never passes silently.
 */
export function evaluateAudit(
  report: unknown,
  exceptions: readonly AdvisoryException[],
  today: Date,
): readonly AuditFinding[] {
  if (!isRecord(report) || 'error' in report || !isRecord(report['vulnerabilities'])) {
    throw new Error('npm audit did not return a vulnerability report');
  }
  const day = today.toISOString().slice(0, 10);
  const valid = new Set(exceptions.filter((e) => day <= e.expires).map((e) => e.ghsa));
  const findings = new Map<string, AuditFinding>();
  for (const vulnerability of Object.values(report['vulnerabilities'])) {
    const via =
      isRecord(vulnerability) && Array.isArray(vulnerability['via']) ? vulnerability['via'] : [];
    for (const advisory of via) {
      if (!isRecord(advisory) || typeof advisory['url'] !== 'string') {
        continue;
      }
      const severity = String(advisory['severity']);
      if (!BLOCKING_SEVERITIES.has(severity)) {
        continue;
      }
      const ghsa = advisory['url'].split('/').pop() ?? advisory['url'];
      findings.set(`${ghsa}:${String(advisory['name'])}`, {
        ghsa,
        severity,
        packageName: String(advisory['name']),
        allowed: valid.has(ghsa),
      });
    }
  }
  return [...findings.values()];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

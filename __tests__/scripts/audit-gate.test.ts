import { describe, expect, it } from 'vitest';

import { evaluateAudit } from '../../scripts/lib/audit-gate';

const EXCEPTION = { ghsa: 'GHSA-86w9-cpqp-85rv', expires: '2027-01-24', reason: 'reviewed' };

function report(...advisories: Array<{ ghsa: string; severity: string; name?: string }>) {
  return {
    vulnerabilities: {
      'node-forge': {
        via: advisories.map((a) => ({
          name: a.name ?? 'node-forge',
          severity: a.severity,
          url: `https://github.com/advisories/${a.ghsa}`,
        })),
      },
      'ask-sdk-express-adapter': { via: ['node-forge'] },
    },
  };
}
const blocking = (findings: ReturnType<typeof evaluateAudit>) => findings.filter((f) => !f.allowed);

describe('evaluateAudit', () => {
  it('allows the excepted advisory through its expiry date', () => {
    const findings = evaluateAudit(
      report({ ghsa: EXCEPTION.ghsa, severity: 'high' }),
      [EXCEPTION],
      new Date('2027-01-24T23:00:00Z'),
    );

    expect(findings).toHaveLength(1);
    expect(blocking(findings)).toEqual([]);
  });

  it('blocks the excepted advisory the day after it expires', () => {
    const findings = evaluateAudit(
      report({ ghsa: EXCEPTION.ghsa, severity: 'high' }),
      [EXCEPTION],
      new Date('2027-01-25T00:00:00Z'),
    );

    expect(blocking(findings)).toHaveLength(1);
  });

  it('blocks any other high or critical advisory', () => {
    const findings = evaluateAudit(
      report(
        { ghsa: EXCEPTION.ghsa, severity: 'high' },
        { ghsa: 'GHSA-aaaa-bbbb-cccc', severity: 'critical', name: 'other' },
      ),
      [EXCEPTION],
      new Date('2026-10-24T00:00:00Z'),
    );

    expect(blocking(findings).map((f) => f.ghsa)).toEqual(['GHSA-aaaa-bbbb-cccc']);
  });

  it('ignores moderate and low advisories', () => {
    const findings = evaluateAudit(
      report({ ghsa: 'GHSA-aaaa-bbbb-cccc', severity: 'moderate' }),
      [],
      new Date('2026-10-24T00:00:00Z'),
    );

    expect(findings).toEqual([]);
  });

  it.each([null, { error: { code: 'ENOTFOUND' } }, { metadata: {} }])(
    'refuses to pass a report it cannot read: %j',
    (bad) => {
      expect(() => evaluateAudit(bad, [EXCEPTION], new Date())).toThrow();
    },
  );
});

import { describe, expect, it } from 'vitest';

import { evaluateAudit } from '../../scripts/lib/security-audit';

const FORGE = 'GHSA-86w9-cpqp-85rv';
const EXCEPTIONS = [{ advisory: FORGE, until: '2027-01-24', reason: 'reviewed' }];

function advisory(id: string, severity: string) {
  return {
    source: 1,
    name: 'pkg',
    title: `title ${id}`,
    url: `https://github.com/advisories/${id}`,
    severity,
  };
}

/** The shape `npm audit --omit=dev --json` reports for the node-forge exception today. */
function report(extra: Record<string, unknown> = {}) {
  return {
    auditReportVersion: 2,
    vulnerabilities: {
      'ask-sdk-express-adapter': {
        name: 'ask-sdk-express-adapter',
        severity: 'high',
        via: ['node-forge'],
      },
      'node-forge': { name: 'node-forge', severity: 'high', via: [advisory(FORGE, 'high')] },
      ...extra,
    },
  };
}

describe('evaluateAudit', () => {
  it('allows exactly the reviewed advisory, including through a dependent package', () => {
    const verdict = evaluateAudit(report(), EXCEPTIONS, '2026-10-24');

    expect(verdict.ok).toBe(true);
    expect(verdict.notes).toEqual([`allowed ${FORGE} until 2027-01-24: reviewed`]);
  });

  it('still allows it on the last day of the exception', () => {
    expect(evaluateAudit(report(), EXCEPTIONS, '2027-01-24').ok).toBe(true);
  });

  it('fails the day after the exception ends', () => {
    const verdict = evaluateAudit(report(), EXCEPTIONS, '2027-01-25');

    expect(verdict.ok).toBe(false);
    expect(verdict.failures).toContain(`exception ${FORGE} expired on 2027-01-24`);
    expect(verdict.failures.some((failure) => failure.startsWith(`node-forge: ${FORGE}`))).toBe(
      true,
    );
  });

  it('fails an expired exception even when the finding is gone', () => {
    const verdict = evaluateAudit(
      { auditReportVersion: 2, vulnerabilities: {} },
      EXCEPTIONS,
      '2027-02-01',
    );

    expect(verdict.ok).toBe(false);
  });

  it.each(['high', 'critical'])('fails on any other %s advisory', (severity) => {
    const other = { name: 'other', severity, via: [advisory('GHSA-aaaa-bbbb-cccc', severity)] };

    const verdict = evaluateAudit(report({ other }), EXCEPTIONS, '2026-10-24');

    expect(verdict.ok).toBe(false);
    expect(verdict.failures).toEqual([
      `other: GHSA-aaaa-bbbb-cccc (${severity}) title GHSA-aaaa-bbbb-cccc`,
    ]);
  });

  it('fails when the excepted package also carries a second high advisory', () => {
    const forge = {
      name: 'node-forge',
      severity: 'high',
      via: [advisory(FORGE, 'high'), advisory('GHSA-dddd-eeee-ffff', 'high')],
    };

    const verdict = evaluateAudit(report({ 'node-forge': forge }), EXCEPTIONS, '2026-10-24');

    expect(verdict.ok).toBe(false);
    expect(verdict.failures.join('\n')).toContain('GHSA-dddd-eeee-ffff');
  });

  it('ignores moderate and low findings', () => {
    const minor = {
      name: 'minor',
      severity: 'moderate',
      via: [advisory('GHSA-1111-2222-3333', 'moderate')],
    };

    expect(evaluateAudit(report({ minor }), EXCEPTIONS, '2026-10-24').ok).toBe(true);
  });

  it('fails without exceptions on the current finding', () => {
    expect(evaluateAudit(report(), [], '2026-10-24').ok).toBe(false);
  });

  it.each([
    ['no output', undefined],
    ['an npm error', { error: { code: 'ENOTFOUND', summary: 'registry unreachable' } }],
    ['an old report version', { auditReportVersion: 1, advisories: {} }],
  ])('fails closed on %s', (_label, value) => {
    expect(evaluateAudit(value, EXCEPTIONS, '2026-10-24').ok).toBe(false);
  });

  it('notes an exception that no longer matches a finding', () => {
    const verdict = evaluateAudit(
      { auditReportVersion: 2, vulnerabilities: {} },
      EXCEPTIONS,
      '2026-10-24',
    );

    expect(verdict.ok).toBe(true);
    expect(verdict.notes).toEqual([`exception ${FORGE} no longer matches a finding; remove it`]);
  });
});

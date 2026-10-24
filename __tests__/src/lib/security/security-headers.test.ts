import { describe, expect, it } from 'vitest';

import { securityHeaders } from '@lib/security';

const valueOf = (headers: ReturnType<typeof securityHeaders>, key: string) =>
  headers.find((header) => header.key === key)?.value;

describe('securityHeaders', () => {
  const development = securityHeaders({ isProduction: false });

  it('carries the nonce-free content security policy', () => {
    expect(valueOf(development, 'Content-Security-Policy')).toBe(
      "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
    );
  });

  it('forbids sniffing and foreign framing', () => {
    expect(valueOf(development, 'X-Content-Type-Options')).toBe('nosniff');
    expect(valueOf(development, 'X-Frame-Options')).toBe('SAMEORIGIN');
  });

  it('keeps paths and queries (emailed links) from leaving the site', () => {
    expect(valueOf(development, 'Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('turns off camera, microphone and geolocation', () => {
    expect(valueOf(development, 'Permissions-Policy')).toBe(
      'camera=(), microphone=(), geolocation=()',
    );
  });

  it('sends HSTS in production only', () => {
    expect(valueOf(development, 'Strict-Transport-Security')).toBeUndefined();
    expect(valueOf(securityHeaders({ isProduction: true }), 'Strict-Transport-Security')).toBe(
      'max-age=63072000; includeSubDomains',
    );
  });

  it('lists each header once', () => {
    const keys = securityHeaders({ isProduction: true }).map((header) => header.key);

    expect(new Set(keys).size).toBe(keys.length);
  });
});

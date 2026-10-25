/**
 * Runs once when a Next.js server instance starts, before it serves a request. On Node.js only:
 * reading the server configuration validates it (a bad deployment fails here, at startup, not on
 * the first request that happens to import it), then the audit trail's daily retention starts.
 * The edge runtime has neither the configuration nor the database, and Vitest sets no runtime.
 */
export async function register(): Promise<void> {
  // A positive `=== 'nodejs'` block (not an early return), so the edge bundle drops these imports:
  // the database client needs `fs`, which the edge runtime does not have (Next instrumentation guide).
  // eslint-disable-next-line no-restricted-syntax -- Next.js sets NEXT_RUNTIME itself; it is no configuration (see src/types/next-runtime.d.ts).
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@lib/config/server');
    const { startAuditRetention } = await import('@modules/audit');
    // `once`: a second register (dev reload) does not start a second timer.
    startAuditRetention();
  }
}

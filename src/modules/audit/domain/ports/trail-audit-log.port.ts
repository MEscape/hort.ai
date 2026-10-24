/**
 * What the trail itself does that operations must see. Not website events:
 * these go to the logs only, never into the trail they describe.
 */
export interface TrailEvent {
  readonly type: 'audit.pruned';
  readonly deletedCount: number;
  readonly retentionDays: number;
}

/** Append-only. `record` is synchronous and MUST NOT throw or block. */
export interface TrailAuditLog {
  record(event: TrailEvent): void;
}

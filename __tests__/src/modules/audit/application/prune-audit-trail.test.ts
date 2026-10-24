import { describe, expect, it } from 'vitest';

import { PruneAuditTrail } from '@modules/audit/application/commands/prune-audit-trail';
import type { TrailEvent } from '@modules/audit/domain/ports/trail-audit-log.port';

import { MS_PER_DAY } from '@lib/utils';

import { NOW, STORE_DOWN, clock, fakeRepository } from '../fakes';

function build(options: Parameters<typeof fakeRepository>[0] = {}, retentionDays = 365) {
  const entries = fakeRepository(options);
  const events: TrailEvent[] = [];
  const prune = new PruneAuditTrail({
    entries,
    clock,
    audit: { record: (event) => events.push(event) },
    retentionDays,
  });
  return { prune, entries, events };
}

describe('PruneAuditTrail', () => {
  it('removes what is older than the retention, counted back from the clock', async () => {
    const { prune, entries } = build({ deleted: 12 }, 30);

    const result = await prune.execute();

    expect(result.isOk() && result.value).toBe(12);
    expect(entries.calls.deletedBefore).toEqual([new Date(NOW.getTime() - 30 * MS_PER_DAY)]);
  });

  it('logs what it removed, for operations (and never writes into the trail it prunes)', async () => {
    const { prune, events, entries } = build({ deleted: 12 }, 30);

    await prune.execute();

    expect(events).toEqual([{ type: 'audit.pruned', deletedCount: 12, retentionDays: 30 }]);
    expect(entries.calls.appended).toEqual([]);
  });

  it('reports a failing store as a failure and logs no sweep that did not happen', async () => {
    const { prune, events } = build({ failWith: STORE_DOWN });

    const result = await prune.execute();

    expect(result.isErr() && result.error.code).toBe('audit.persistence_failed');
    expect(events).toEqual([]);
  });
});

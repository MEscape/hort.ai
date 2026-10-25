#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/6099aa947d35bd4c5a55c52faf7686b47fd7060ba0c4a1be4d267431ee38bfee/contract';
import startContract from '../../snapshots/6099aa947d35bd4c5a55c52faf7686b47fd7060ba0c4a1be4d267431ee38bfee/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/6d86b0e038da36fd6ceb07e8b1489f39c9d8d147eeaa87c77e6420e808ea32ce/contract';
import endContract from '../../snapshots/6d86b0e038da36fd6ceb07e8b1489f39c9d8d147eeaa87c77e6420e808ea32ce/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'ChildProfile',
        column: col('voiceNoticeConfirmedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ChildProfile',
        column: col('voiceNoticeVersion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'ChildProfile',
        constraint: 'ChildProfile_voice_notice_rule_8b4fac41',
        expression: sql`("voiceNoticeVersion" IS NULL) = ("voiceNoticeConfirmedAt" IS NULL)`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

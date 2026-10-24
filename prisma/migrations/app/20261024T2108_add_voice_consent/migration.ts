#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1863863b67edd6749659a9ad9a1e312cbede78ca8be88952e2c146a38fc427ef/contract';
import endContract from '../../snapshots/1863863b67edd6749659a9ad9a1e312cbede78ca8be88952e2c146a38fc427ef/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8db5f60cf8e0fb19d3d2a7b9ebb18c733aa05cae9dd7ecbd9b96916d538df7e8/contract';
import startContract from '../../snapshots/8db5f60cf8e0fb19d3d2a7b9ebb18c733aa05cae9dd7ecbd9b96916d538df7e8/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'VoiceConsent',
        columns: [
          col('grantedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('parentId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('revokedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['tenantId', 'parentId'])],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

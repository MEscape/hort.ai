#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/8db5f60cf8e0fb19d3d2a7b9ebb18c733aa05cae9dd7ecbd9b96916d538df7e8/contract';
import endContract from '../../snapshots/8db5f60cf8e0fb19d3d2a7b9ebb18c733aa05cae9dd7ecbd9b96916d538df7e8/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'AuditEntry',
        columns: [
          col('actorId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('actorKind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('details', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('occurredAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('severity', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('source', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'AuditEntry_actorKind_check_eb9fa190',
            sql`"actorKind" IN ('MEMBER', 'VISITOR', 'SYSTEM')`,
          ),
          checkExpression(
            'AuditEntry_severity_check_f199a339',
            sql`"severity" IN ('INFO', 'WARN')`,
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditEntry',
        index: 'AuditEntry_occurredAt_idx_c6b89167',
        columns: ['occurredAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditEntry',
        index: 'AuditEntry_tenantId_actorId_occurredAt_idx_c39c0fc6',
        columns: ['tenantId', 'actorId', 'occurredAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditEntry',
        index: 'AuditEntry_tenantId_occurredAt_idx_735df4e8',
        columns: ['tenantId', 'occurredAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditEntry',
        index: 'AuditEntry_tenantId_source_type_occurredAt_idx_6b022bb0',
        columns: ['tenantId', 'source', 'type', 'occurredAt'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

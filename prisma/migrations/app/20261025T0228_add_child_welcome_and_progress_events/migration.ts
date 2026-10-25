#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/073e39acca7299a40a57a7f3fae59f0191a148a085bae26fc5ac55b61d1f5495/contract';
import endContract from '../../snapshots/073e39acca7299a40a57a7f3fae59f0191a148a085bae26fc5ac55b61d1f5495/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/6d86b0e038da36fd6ceb07e8b1489f39c9d8d147eeaa87c77e6420e808ea32ce/contract';
import startContract from '../../snapshots/6d86b0e038da36fd6ceb07e8b1489f39c9d8d147eeaa87c77e6420e808ea32ce/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'ProgressEvent',
        columns: [
          col('childProfileId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('eventKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('occurredAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('ownerId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('xp', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ProgressEvent_event_key_rule_eb4734d2',
            sql`char_length("eventKey") BETWEEN 1 AND 64`,
          ),
          checkExpression(
            'ProgressEvent_kind_check_ffbb7aee',
            sql`"kind" IN ('daily_reward', 'learning')`,
          ),
          checkExpression('ProgressEvent_xp_rule_619b4399', sql`"xp" BETWEEN 1 AND 100`),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'ChildProfile',
        column: col('welcomeCompletedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'ChildProfile',
        constraint: 'ChildProfile_welcome_after_setup_rule_1a425757',
        expression: sql`"welcomeCompletedAt" IS NULL OR "setupCompletedAt" IS NOT NULL`,
      }),
      this.addUnique({
        schema: 'public',
        table: 'ProgressEvent',
        constraint: 'ProgressEvent_childProfileId_eventKey_key',
        columns: ['childProfileId', 'eventKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ProgressEvent',
        index: 'ProgressEvent_childProfileId_idx_afadb118',
        columns: ['childProfileId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ProgressEvent',
        foreignKey: {
          name: 'ProgressEvent_childProfileId_fkey',
          columns: ['childProfileId'],
          references: { schema: 'public', table: 'ChildProfile', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

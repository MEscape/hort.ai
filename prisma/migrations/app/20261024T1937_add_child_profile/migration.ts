#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2f8d14e92fd7676331a0b3ee72cc2518a098c827d0e30cfeac6ee99d9ccc970c/contract';
import endContract from '../../snapshots/2f8d14e92fd7676331a0b3ee72cc2518a098c827d0e30cfeac6ee99d9ccc970c/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8db5f60cf8e0fb19d3d2a7b9ebb18c733aa05cae9dd7ecbd9b96916d538df7e8/contract';
import startContract from '../../snapshots/8db5f60cf8e0fb19d3d2a7b9ebb18c733aa05cae9dd7ecbd9b96916d538df7e8/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
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
        table: 'ChildProfile',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('displayName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('federalState', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('grade', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ownerId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('setupCompletedAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('voiceConsent', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ChildProfile_display_name_rule_0a455fd0',
            sql`char_length("displayName") BETWEEN 1 AND 24`,
          ),
          checkExpression(
            'ChildProfile_federalState_check_f3b2f10d',
            sql`"federalState" IN ('BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH')`,
          ),
          checkExpression('ChildProfile_grade_rule_ab1ddaff', sql`"grade" BETWEEN 1 AND 4`),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChildProfile',
        index: 'ChildProfile_one_unfinished_per_owner_15ad2a20',
        columns: ['tenantId', 'ownerId'],
        extras: { where: sql`("setupCompletedAt" IS NULL)`, unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChildProfile',
        index: 'ChildProfile_tenantId_ownerId_createdAt_idx_6658b794',
        columns: ['tenantId', 'ownerId', 'createdAt'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

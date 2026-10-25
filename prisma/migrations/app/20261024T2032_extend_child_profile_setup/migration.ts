#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/26a3e1f976072c0c51fe266023aef5775ed0e6eb2cf0d6984d93340fae52b454/contract';
import endContract from '../../snapshots/26a3e1f976072c0c51fe266023aef5775ed0e6eb2cf0d6984d93340fae52b454/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/2f8d14e92fd7676331a0b3ee72cc2518a098c827d0e30cfeac6ee99d9ccc970c/contract';
import startContract from '../../snapshots/2f8d14e92fd7676331a0b3ee72cc2518a098c827d0e30cfeac6ee99d9ccc970c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, sql } from '@prisma/orm-postgres/migration';
import postgres from '@prisma/orm-postgres/runtime';
import { contractFromJson } from '@prisma/orm-postgres/static';

// Builds the typed query builder only; connects lazily, so emitting this file opens no connection.
const { sql: db, contract } = postgres({ contract: contractFromJson<End>(endContract) });

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'ChildProfile',
        column: col('allowedFromMinute', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ChildProfile',
        column: col('allowedUntilMinute', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ChildProfile',
        column: col('dailyLimitMinutes', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ChildProfile',
        column: col('guardianConfirmedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ChildProfile',
        column: col('guardianConsentVersion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ChildProfile',
        column: col('interests', 'text[]', {
          notNull: true,
          default: lit([]),
          codecRef: { codecId: 'pg/text@1', many: true },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ChildProfile',
        column: col('learningInsights', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ChildProfile',
        column: col('setupStep', 'text', {
          notNull: true,
          default: lit('child'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'ChildProfile',
        column: col('tutorId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      // Existing rows: a finished setup is 'done', an unfinished one had its child details saved, so
      // it resumes at the interests step.
      this.dataTransform(contract, 'backfill-child-profile-setup-step', {
        backfillsColumn: { schema: 'public', table: 'ChildProfile', column: 'setupStep' },
        check: () =>
          db.public.ChildProfile.select('id')
            .where((f, fns) => fns.eq(f.setupStep, 'child'))
            .limit(1),
        run: [
          () =>
            db.public.ChildProfile.update({ setupStep: 'done' }).where((f, fns) =>
              fns.and(fns.eq(f.setupStep, 'child'), fns.ne(f.setupCompletedAt, null)),
            ),
          () =>
            db.public.ChildProfile.update({ setupStep: 'interests' }).where((f, fns) =>
              fns.eq(f.setupStep, 'child'),
            ),
        ],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'ChildProfile',
        constraint: 'ChildProfile_done_rule_888ed74c',
        expression: sql`("setupStep" = 'done') = ("setupCompletedAt" IS NOT NULL)`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'ChildProfile',
        constraint: 'ChildProfile_allowed_window_rule_75d4fbb3',
        expression: sql`("allowedFromMinute" IS NULL AND "allowedUntilMinute" IS NULL) OR ("allowedFromMinute" IS NOT NULL AND "allowedUntilMinute" IS NOT NULL AND "allowedFromMinute" >= 0 AND "allowedUntilMinute" <= 1440 AND "allowedFromMinute" % 15 = 0 AND "allowedUntilMinute" % 15 = 0 AND "allowedUntilMinute" - "allowedFromMinute" >= 30)`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'ChildProfile',
        constraint: 'ChildProfile_daily_limit_rule_103a53e8',
        expression: sql`"dailyLimitMinutes" IS NULL OR "dailyLimitMinutes" IN (15, 30, 45, 60, 90)`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'ChildProfile',
        constraint: 'ChildProfile_interests_check_18d24d59',
        expression: sql`array_remove("interests", NULL) <@ '{"nature","animals","science","art","music","sports","technology","stories","puzzles","history"}'`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'ChildProfile',
        constraint: 'ChildProfile_interests_count_rule_0c69299a',
        expression: sql`cardinality("interests") <= 4`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'ChildProfile',
        constraint: 'ChildProfile_interests_elem_not_null_4b23e016',
        expression: sql`array_position("interests", NULL) IS NULL`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'ChildProfile',
        constraint: 'ChildProfile_setupStep_check_c4a680fd',
        expression: sql`"setupStep" IN ('child', 'interests', 'tutor', 'controls', 'review', 'done')`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

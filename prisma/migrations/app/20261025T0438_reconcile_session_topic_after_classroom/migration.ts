#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/8f90a014cfc1c9c32a01d95dad6cd89b3515c3ca47dfd8ae078cd5e51ac97e79/contract';
import startContract from '../../snapshots/8f90a014cfc1c9c32a01d95dad6cd89b3515c3ca47dfd8ae078cd5e51ac97e79/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/df028899cf6d03459369581c0d338055d77b7232cf36e23c686f7b0e33287ceb/contract';
import endContract from '../../snapshots/df028899cf6d03459369581c0d338055d77b7232cf36e23c686f7b0e33287ceb/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'HelpSession',
        column: col('classifiedBy', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'HelpSession',
        column: col('competencyCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'HelpSession',
        column: col('intent', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'HelpSession',
        column: col('openTopicLabel', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'HelpSession',
        column: col('opening', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'HelpSession',
        constraint: 'HelpSession_classifiedBy_check_a4f40f73',
        expression: sql`"classifiedBy" IN ('JEV', 'FALLBACK')`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'HelpSession',
        constraint: 'HelpSession_competency_code_rule_a887e22f',
        expression: sql`"competencyCode" IS NULL OR char_length("competencyCode") BETWEEN 1 AND 300`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'HelpSession',
        constraint: 'HelpSession_intent_check_c8c67b53',
        expression: sql`"intent" IN ('HOMEWORK', 'CURIOSITY', 'SMALL_TALK')`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'HelpSession',
        constraint: 'HelpSession_open_topic_label_rule_dce03648',
        expression: sql`"openTopicLabel" IS NULL OR char_length("openTopicLabel") BETWEEN 2 AND 40`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'HelpSession',
        constraint: 'HelpSession_opening_check_d0f19b01',
        expression: sql`"opening" IN ('CLARIFY', 'REDIRECT')`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'HelpSession',
        constraint: 'HelpSession_redirect_rule_362674df',
        expression: sql`"opening" IS DISTINCT FROM 'REDIRECT' OR "intent" IN ('CURIOSITY', 'SMALL_TALK')`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

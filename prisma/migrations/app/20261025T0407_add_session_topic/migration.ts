#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/07483865e11ab7887d81d0a4e936540f0b0813e59dc953d55fed5029f530b865/contract';
import endContract from '../../snapshots/07483865e11ab7887d81d0a4e936540f0b0813e59dc953d55fed5029f530b865/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/eca80640cb0a769525df6288850067119387f7f45ed38d34e0c24729a1900541/contract';
import startContract from '../../snapshots/eca80640cb0a769525df6288850067119387f7f45ed38d34e0c24729a1900541/contract.json' with { type: 'json' };
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

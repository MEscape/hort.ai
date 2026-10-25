#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/3af585b99de98bbac25f4ee99788c93e52f7b8a8c93c42f06aba0bfa32afd0fb/contract';
import endContract from '../../snapshots/3af585b99de98bbac25f4ee99788c93e52f7b8a8c93c42f06aba0bfa32afd0fb/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/df028899cf6d03459369581c0d338055d77b7232cf36e23c686f7b0e33287ceb/contract';
import startContract from '../../snapshots/df028899cf6d03459369581c0d338055d77b7232cf36e23c686f7b0e33287ceb/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'HelpSession',
        column: col('areaId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'HelpSession',
        column: col('placeId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'HelpSession',
        constraint: 'HelpSession_area_id_rule_f94bd28e',
        expression: sql`"areaId" IS NULL OR "areaId" ~ '^[a-z][a-z0-9-]{1,40}$'`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'HelpSession',
        constraint: 'HelpSession_place_id_rule_2202e11e',
        expression: sql`"placeId" IS NULL OR ("areaId" IS NOT NULL AND "placeId" ~ '^[a-z][a-z0-9-]{1,40}$')`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

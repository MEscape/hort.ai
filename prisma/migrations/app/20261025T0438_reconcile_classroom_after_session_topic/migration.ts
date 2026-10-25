#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/07483865e11ab7887d81d0a4e936540f0b0813e59dc953d55fed5029f530b865/contract';
import startContract from '../../snapshots/07483865e11ab7887d81d0a4e936540f0b0813e59dc953d55fed5029f530b865/contract.json' with { type: 'json' };
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
        table: 'Classroom',
        column: col('inviteCodeCiphertext', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'Classroom',
        constraint: 'Classroom_invite_code_ciphertext_rule_f890fa23',
        expression: sql`"inviteCodeCiphertext" IS NULL OR char_length("inviteCodeCiphertext") BETWEEN 1 AND 256`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

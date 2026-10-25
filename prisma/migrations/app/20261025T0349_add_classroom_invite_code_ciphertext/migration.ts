#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/8f90a014cfc1c9c32a01d95dad6cd89b3515c3ca47dfd8ae078cd5e51ac97e79/contract';
import endContract from '../../snapshots/8f90a014cfc1c9c32a01d95dad6cd89b3515c3ca47dfd8ae078cd5e51ac97e79/contract.json' with { type: 'json' };
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

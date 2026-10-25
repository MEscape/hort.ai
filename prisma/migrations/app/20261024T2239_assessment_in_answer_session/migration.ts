#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/b4c24533b3b5199288e9d082d4afd19bed5e5d6520273577cb784a15c6051594/contract';
import endContract from '../../snapshots/b4c24533b3b5199288e9d082d4afd19bed5e5d6520273577cb784a15c6051594/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/fc105dec9ca1656b4d8cacd0524fa429234a3214a4bdb3ec70fafbbcc1d98622/contract';
import startContract from '../../snapshots/fc105dec9ca1656b4d8cacd0524fa429234a3214a4bdb3ec70fafbbcc1d98622/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'AnswerAssessment',
        constraint: 'AnswerAssessment_answerId_fkey',
        kind: 'foreignKey',
      }),
      this.addUnique({
        schema: 'public',
        table: 'AnswerAssessment',
        constraint: 'AnswerAssessment_answerId_sessionId_key',
        columns: ['answerId', 'sessionId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ChildAnswer',
        constraint: 'ChildAnswer_id_sessionId_key',
        columns: ['id', 'sessionId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AnswerAssessment',
        foreignKey: {
          name: 'AnswerAssessment_answerId_sessionId_fkey',
          columns: ['answerId', 'sessionId'],
          references: { schema: 'public', table: 'ChildAnswer', columns: ['id', 'sessionId'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

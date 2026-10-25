#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/073e39acca7299a40a57a7f3fae59f0191a148a085bae26fc5ac55b61d1f5495/contract';
import startContract from '../../snapshots/073e39acca7299a40a57a7f3fae59f0191a148a085bae26fc5ac55b61d1f5495/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/eca80640cb0a769525df6288850067119387f7f45ed38d34e0c24729a1900541/contract';
import endContract from '../../snapshots/eca80640cb0a769525df6288850067119387f7f45ed38d34e0c24729a1900541/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'AnswerAssessment',
        constraint: 'AnswerAssessment_text_rule_d85c71d7',
      }),
      this.dropCheckConstraint({
        schema: 'public',
        table: 'ComprehensionQuestion',
        constraint: 'ComprehensionQuestion_text_rule_d85c71d7',
      }),
      this.dropCheckConstraint({
        schema: 'public',
        table: 'HintEvent',
        constraint: 'HintEvent_text_rule_d85c71d7',
      }),
      this.addColumn({
        schema: 'public',
        table: 'AnswerAssessment',
        column: col('assessedBy', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'AnswerAssessment',
        column: col('hintLevel', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'HintEvent',
        column: col('fallbackReason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dropNotNull({ schema: 'public', table: 'AnswerAssessment', column: 'result' }),
      this.dropNotNull({ schema: 'public', table: 'AnswerAssessment', column: 'text' }),
      this.dropNotNull({ schema: 'public', table: 'ComprehensionQuestion', column: 'text' }),
      this.dropNotNull({ schema: 'public', table: 'HintEvent', column: 'text' }),
      this.addRequiredColumnToEmptyTable({
        schema: 'public',
        table: 'HelpSession',
        column: 'subject',
        type: 'text',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'AnswerAssessment',
        constraint: 'AnswerAssessment_assessedBy_check_5ef9c7ef',
        expression: sql`"assessedBy" IN ('SOLUTION_KEY', 'AI')`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'AnswerAssessment',
        constraint: 'AnswerAssessment_assessed_rule_720eae42',
        expression: sql`("result" IS NULL) = ("assessedBy" IS NULL)`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'AnswerAssessment',
        constraint: 'AnswerAssessment_hintLevel_check_0e898a46',
        expression: sql`"hintLevel" IN ('UNDERSTAND_TASK', 'ACTIVATE_PRIOR_KNOWLEDGE', 'NEXT_STEP', 'SIMILAR_EXAMPLE')`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'AnswerAssessment',
        constraint: 'AnswerAssessment_text_rule_cf2e486d',
        expression: sql`"text" IS NULL OR char_length("text") BETWEEN 1 AND 1000`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'ComprehensionQuestion',
        constraint: 'ComprehensionQuestion_text_rule_cf2e486d',
        expression: sql`"text" IS NULL OR char_length("text") BETWEEN 1 AND 1000`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'HelpSession',
        constraint: 'HelpSession_subject_check_50a44108',
        expression: sql`"subject" IN ('MATH', 'GERMAN', 'GENERAL_STUDIES', 'ENGLISH')`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'HintEvent',
        constraint: 'HintEvent_fallback_reason_rule_350b7c97',
        expression: sql`"fallbackReason" IS NULL OR char_length("fallbackReason") BETWEEN 1 AND 64`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'HintEvent',
        constraint: 'HintEvent_text_or_fallback_rule_97dc2b73',
        expression: sql`("text" IS NULL) = ("fallbackReason" IS NOT NULL)`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'HintEvent',
        constraint: 'HintEvent_text_rule_cf2e486d',
        expression: sql`"text" IS NULL OR char_length("text") BETWEEN 1 AND 1000`,
      }),
      this.createIndex({
        schema: 'public',
        table: 'HelpSession',
        index: 'HelpSession_one_active_per_child_f47b7342',
        columns: ['childProfileId'],
        extras: { where: sql`("status" = 'ACTIVE')`, unique: true },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

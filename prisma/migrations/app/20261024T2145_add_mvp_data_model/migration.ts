#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/8db5f60cf8e0fb19d3d2a7b9ebb18c733aa05cae9dd7ecbd9b96916d538df7e8/contract';
import startContract from '../../snapshots/8db5f60cf8e0fb19d3d2a7b9ebb18c733aa05cae9dd7ecbd9b96916d538df7e8/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/fc105dec9ca1656b4d8cacd0524fa429234a3214a4bdb3ec70fafbbcc1d98622/contract';
import endContract from '../../snapshots/fc105dec9ca1656b4d8cacd0524fa429234a3214a4bdb3ec70fafbbcc1d98622/contract.json' with { type: 'json' };
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
        table: 'AnswerAssessment',
        columns: [
          col('answerId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('occurredAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('result', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sessionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('text', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'AnswerAssessment_key_rule_2bdf8ced',
            sql`char_length("idempotencyKey") BETWEEN 1 AND 128`,
          ),
          checkExpression(
            'AnswerAssessment_result_check_e1ddf6de',
            sql`"result" IN ('CORRECT', 'PARTLY_CORRECT', 'NOT_YET')`,
          ),
          checkExpression(
            'AnswerAssessment_text_rule_d85c71d7',
            sql`char_length("text") BETWEEN 1 AND 1000`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Assignment',
        columns: [
          col('classroomId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('dueDate', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ownerId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('solutionKey', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('taskText', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Assignment_due_date_rule_612b87d2',
            sql`"dueDate" IS NULL OR "dueDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`,
          ),
          checkExpression(
            'Assignment_solution_key_rule_46feed79',
            sql`"solutionKey" IS NULL OR char_length("solutionKey") BETWEEN 1 AND 4000`,
          ),
          checkExpression(
            'Assignment_task_text_rule_a9ca7f56',
            sql`char_length("taskText") BETWEEN 1 AND 4000`,
          ),
          checkExpression(
            'Assignment_title_rule_c398b0c6',
            sql`char_length("title") BETWEEN 1 AND 120`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'ChildAnswer',
        columns: [
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('occurredAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('sessionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('text', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ChildAnswer_key_rule_2bdf8ced',
            sql`char_length("idempotencyKey") BETWEEN 1 AND 128`,
          ),
          checkExpression(
            'ChildAnswer_text_rule_d85c71d7',
            sql`char_length("text") BETWEEN 1 AND 1000`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'ChildProfile',
        columns: [
          col('companion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
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
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('voiceConsent', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ChildProfile_companion_check_faf15343',
            sql`"companion" IN ('MAX', 'LILI', 'FINA')`,
          ),
          checkExpression(
            'ChildProfile_display_name_rule_610003c6',
            sql`char_length("displayName") BETWEEN 1 AND 40`,
          ),
          checkExpression(
            'ChildProfile_federalState_check_f3b2f10d',
            sql`"federalState" IN ('BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH')`,
          ),
          checkExpression('ChildProfile_grade_rule_ab1ddaff', sql`"grade" BETWEEN 1 AND 4`),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'ClassMembership',
        columns: [
          col('childProfileId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('classroomId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('joinedAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Classroom',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('federalState', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('grade', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('inviteCodeHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('inviteCodeIssuedAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ownerId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('subject', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Classroom_federalState_check_f3b2f10d',
            sql`"federalState" IN ('BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH')`,
          ),
          checkExpression('Classroom_grade_rule_ab1ddaff', sql`"grade" BETWEEN 1 AND 4`),
          checkExpression(
            'Classroom_invite_code_rule_2c36461a',
            sql`"inviteCodeHash" ~ '^[0-9a-f]{64}$'`,
          ),
          checkExpression(
            'Classroom_name_rule_e74537bf',
            sql`char_length("name") BETWEEN 1 AND 80`,
          ),
          checkExpression(
            'Classroom_status_check_aef30f3b',
            sql`"status" IN ('ACTIVE', 'ARCHIVED')`,
          ),
          checkExpression(
            'Classroom_subject_check_50a44108',
            sql`"subject" IN ('MATH', 'GERMAN', 'GENERAL_STUDIES', 'ENGLISH')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Competency',
        columns: [
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('documentId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('federalState', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('gradeFrom', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('gradeTo', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('page', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('section', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('subject', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('text', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Competency_code_rule_48216c43',
            sql`"code" ~ '^[a-z0-9][a-z0-9._-]{0,63}$'`,
          ),
          checkExpression(
            'Competency_federalState_check_f3b2f10d',
            sql`"federalState" IN ('BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH')`,
          ),
          checkExpression(
            'Competency_grades_rule_ac9ef3ff',
            sql`"gradeFrom" BETWEEN 1 AND 4 AND "gradeTo" BETWEEN "gradeFrom" AND 4`,
          ),
          checkExpression('Competency_page_rule_bf62d7a1', sql`"page" IS NULL OR "page" >= 1`),
          checkExpression(
            'Competency_section_rule_9c6c51c5',
            sql`char_length("section") BETWEEN 1 AND 200`,
          ),
          checkExpression(
            'Competency_subject_check_50a44108',
            sql`"subject" IN ('MATH', 'GERMAN', 'GENERAL_STUDIES', 'ENGLISH')`,
          ),
          checkExpression(
            'Competency_text_rule_0954facd',
            sql`char_length("text") BETWEEN 1 AND 2000`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'ComprehensionQuestion',
        columns: [
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('occurredAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('repliedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('replyText', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('sessionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('text', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'ComprehensionQuestion_key_rule_2bdf8ced',
            sql`char_length("idempotencyKey") BETWEEN 1 AND 128`,
          ),
          checkExpression(
            'ComprehensionQuestion_replied_rule_fbb9a036',
            sql`("replyText" IS NULL) = ("repliedAt" IS NULL)`,
          ),
          checkExpression(
            'ComprehensionQuestion_reply_rule_7479b1e7',
            sql`"replyText" IS NULL OR char_length("replyText") BETWEEN 1 AND 1000`,
          ),
          checkExpression(
            'ComprehensionQuestion_text_rule_d85c71d7',
            sql`char_length("text") BETWEEN 1 AND 1000`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'CurriculumDocument',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('federalState', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('gradeFrom', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('gradeTo', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sourceKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sourceUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('subject', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('version', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'CurriculumDocument_federalState_check_f3b2f10d',
            sql`"federalState" IN ('BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE', 'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'SH', 'TH')`,
          ),
          checkExpression(
            'CurriculumDocument_grades_rule_ac9ef3ff',
            sql`"gradeFrom" BETWEEN 1 AND 4 AND "gradeTo" BETWEEN "gradeFrom" AND 4`,
          ),
          checkExpression(
            'CurriculumDocument_source_key_rule_fe366478',
            sql`"sourceKey" ~ '^[a-z0-9][a-z0-9._-]{0,63}$'`,
          ),
          checkExpression(
            'CurriculumDocument_subject_check_50a44108',
            sql`"subject" IN ('MATH', 'GERMAN', 'GENERAL_STUDIES', 'ENGLISH')`,
          ),
          checkExpression(
            'CurriculumDocument_title_rule_62d19ca7',
            sql`char_length("title") BETWEEN 1 AND 300`,
          ),
          checkExpression(
            'CurriculumDocument_version_rule_60c3e91e',
            sql`char_length("version") BETWEEN 1 AND 32`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'HelpSession',
        columns: [
          col('assignmentId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('childProfileId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('currentHintLevel', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('endedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ownerId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('startedAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('status', 'text', {
            notNull: true,
            default: lit('ACTIVE'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('taskText', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'HelpSession_currentHintLevel_check_e64b35d3',
            sql`"currentHintLevel" IN ('UNDERSTAND_TASK', 'ACTIVATE_PRIOR_KNOWLEDGE', 'NEXT_STEP', 'SIMILAR_EXAMPLE')`,
          ),
          checkExpression(
            'HelpSession_ended_rule_b21efdd1',
            sql`("status" = 'ACTIVE') = ("endedAt" IS NULL)`,
          ),
          checkExpression(
            'HelpSession_status_check_5295ad5c',
            sql`"status" IN ('ACTIVE', 'COMPLETED', 'ABANDONED')`,
          ),
          checkExpression(
            'HelpSession_task_text_rule_a9ca7f56',
            sql`char_length("taskText") BETWEEN 1 AND 4000`,
          ),
          checkExpression('HelpSession_version_rule_efd86c31', sql`"version" >= 1`),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'HintEvent',
        columns: [
          col('competencyCode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('idempotencyKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('level', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('occurredAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('sessionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('text', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'HintEvent_key_rule_2bdf8ced',
            sql`char_length("idempotencyKey") BETWEEN 1 AND 128`,
          ),
          checkExpression(
            'HintEvent_level_check_31f47b1d',
            sql`"level" IN ('UNDERSTAND_TASK', 'ACTIVATE_PRIOR_KNOWLEDGE', 'NEXT_STEP', 'SIMILAR_EXAMPLE')`,
          ),
          checkExpression(
            'HintEvent_text_rule_d85c71d7',
            sql`char_length("text") BETWEEN 1 AND 1000`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'MaterialSection',
        columns: [
          col('code', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('materialId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('page', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('position', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('section', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('text', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'MaterialSection_code_rule_cca4fb61',
            sql`"code" IS NULL OR "code" ~ '^[a-z0-9][a-z0-9._-]{0,63}$'`,
          ),
          checkExpression('MaterialSection_page_rule_bf62d7a1', sql`"page" IS NULL OR "page" >= 1`),
          checkExpression('MaterialSection_position_rule_f43e8efc', sql`"position" >= 0`),
          checkExpression(
            'MaterialSection_text_rule_0954facd',
            sql`char_length("text") BETWEEN 1 AND 2000`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'TeacherMaterial',
        columns: [
          col('classroomId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('contentType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('objectKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ownerId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sizeBytes', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('UPLOADED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'TeacherMaterial_contentType_check_318a092a',
            sql`"contentType" IN ('PDF', 'TEXT')`,
          ),
          checkExpression(
            'TeacherMaterial_object_key_rule_8983367e',
            sql`char_length("objectKey") BETWEEN 1 AND 512`,
          ),
          checkExpression('TeacherMaterial_size_rule_cff0c8d9', sql`"sizeBytes" >= 0`),
          checkExpression(
            'TeacherMaterial_status_check_e25f07be',
            sql`"status" IN ('UPLOADED', 'PROCESSED', 'FAILED', 'DELETED')`,
          ),
          checkExpression(
            'TeacherMaterial_title_rule_db733145',
            sql`char_length("title") BETWEEN 1 AND 200`,
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'AnswerAssessment',
        constraint: 'AnswerAssessment_answerId_key',
        columns: ['answerId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'AnswerAssessment',
        constraint: 'AnswerAssessment_sessionId_idempotencyKey_key',
        columns: ['sessionId', 'idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ChildAnswer',
        constraint: 'ChildAnswer_sessionId_idempotencyKey_key',
        columns: ['sessionId', 'idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ClassMembership',
        constraint: 'ClassMembership_childProfileId_key',
        columns: ['childProfileId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Classroom',
        constraint: 'Classroom_inviteCodeHash_key',
        columns: ['inviteCodeHash'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Competency',
        constraint: 'Competency_documentId_code_key',
        columns: ['documentId', 'code'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'ComprehensionQuestion',
        constraint: 'ComprehensionQuestion_sessionId_idempotencyKey_key',
        columns: ['sessionId', 'idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'CurriculumDocument',
        constraint: 'CurriculumDocument_sourceKey_version_key',
        columns: ['sourceKey', 'version'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'HintEvent',
        constraint: 'HintEvent_sessionId_idempotencyKey_key',
        columns: ['sessionId', 'idempotencyKey'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'MaterialSection',
        constraint: 'MaterialSection_materialId_position_key',
        columns: ['materialId', 'position'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'TeacherMaterial',
        constraint: 'TeacherMaterial_objectKey_key',
        columns: ['objectKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AnswerAssessment',
        index: 'AnswerAssessment_sessionId_idx_29f415d4',
        columns: ['sessionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Assignment',
        index: 'Assignment_classroomId_createdAt_idx_076fa421',
        columns: ['classroomId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Assignment',
        index: 'Assignment_classroomId_idx_e4a392d3',
        columns: ['classroomId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Assignment',
        index: 'Assignment_tenantId_ownerId_createdAt_idx_6658b794',
        columns: ['tenantId', 'ownerId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChildAnswer',
        index: 'ChildAnswer_sessionId_idx_29f415d4',
        columns: ['sessionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChildAnswer',
        index: 'ChildAnswer_sessionId_occurredAt_idx_13b29b85',
        columns: ['sessionId', 'occurredAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ChildProfile',
        index: 'ChildProfile_tenantId_ownerId_createdAt_idx_6658b794',
        columns: ['tenantId', 'ownerId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ClassMembership',
        index: 'ClassMembership_classroomId_idx_e4a392d3',
        columns: ['classroomId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ClassMembership',
        index: 'ClassMembership_classroomId_joinedAt_idx_5dba71cd',
        columns: ['classroomId', 'joinedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Classroom',
        index: 'Classroom_tenantId_ownerId_createdAt_idx_6658b794',
        columns: ['tenantId', 'ownerId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Competency',
        index: 'Competency_documentId_idx_825ef746',
        columns: ['documentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Competency',
        index: 'Competency_subject_gradeFrom_gradeTo_federalState_idx_6ef5ead8',
        columns: ['subject', 'gradeFrom', 'gradeTo', 'federalState'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ComprehensionQuestion',
        index: 'ComprehensionQuestion_sessionId_idx_29f415d4',
        columns: ['sessionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ComprehensionQuestion',
        index: 'ComprehensionQuestion_sessionId_occurredAt_idx_13b29b85',
        columns: ['sessionId', 'occurredAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'HelpSession',
        index: 'HelpSession_assignmentId_idx_8cfb4ac4',
        columns: ['assignmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'HelpSession',
        index: 'HelpSession_childProfileId_idx_afadb118',
        columns: ['childProfileId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'HelpSession',
        index: 'HelpSession_childProfileId_status_updatedAt_idx_9bd9ef24',
        columns: ['childProfileId', 'status', 'updatedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'HelpSession',
        index: 'HelpSession_tenantId_ownerId_updatedAt_idx_f60bcd45',
        columns: ['tenantId', 'ownerId', 'updatedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'HintEvent',
        index: 'HintEvent_sessionId_idx_29f415d4',
        columns: ['sessionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'HintEvent',
        index: 'HintEvent_sessionId_occurredAt_idx_13b29b85',
        columns: ['sessionId', 'occurredAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'MaterialSection',
        index: 'MaterialSection_materialId_idx_e0f85a6d',
        columns: ['materialId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TeacherMaterial',
        index: 'TeacherMaterial_classroomId_createdAt_idx_076fa421',
        columns: ['classroomId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TeacherMaterial',
        index: 'TeacherMaterial_classroomId_idx_e4a392d3',
        columns: ['classroomId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'TeacherMaterial',
        index: 'TeacherMaterial_tenantId_ownerId_createdAt_idx_6658b794',
        columns: ['tenantId', 'ownerId', 'createdAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AnswerAssessment',
        foreignKey: {
          name: 'AnswerAssessment_sessionId_fkey',
          columns: ['sessionId'],
          references: { schema: 'public', table: 'HelpSession', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AnswerAssessment',
        foreignKey: {
          name: 'AnswerAssessment_answerId_fkey',
          columns: ['answerId'],
          references: { schema: 'public', table: 'ChildAnswer', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Assignment',
        foreignKey: {
          name: 'Assignment_classroomId_fkey',
          columns: ['classroomId'],
          references: { schema: 'public', table: 'Classroom', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ChildAnswer',
        foreignKey: {
          name: 'ChildAnswer_sessionId_fkey',
          columns: ['sessionId'],
          references: { schema: 'public', table: 'HelpSession', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ClassMembership',
        foreignKey: {
          name: 'ClassMembership_classroomId_fkey',
          columns: ['classroomId'],
          references: { schema: 'public', table: 'Classroom', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ClassMembership',
        foreignKey: {
          name: 'ClassMembership_childProfileId_fkey',
          columns: ['childProfileId'],
          references: { schema: 'public', table: 'ChildProfile', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Competency',
        foreignKey: {
          name: 'Competency_documentId_fkey',
          columns: ['documentId'],
          references: { schema: 'public', table: 'CurriculumDocument', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ComprehensionQuestion',
        foreignKey: {
          name: 'ComprehensionQuestion_sessionId_fkey',
          columns: ['sessionId'],
          references: { schema: 'public', table: 'HelpSession', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'HelpSession',
        foreignKey: {
          name: 'HelpSession_childProfileId_fkey',
          columns: ['childProfileId'],
          references: { schema: 'public', table: 'ChildProfile', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'HelpSession',
        foreignKey: {
          name: 'HelpSession_assignmentId_fkey',
          columns: ['assignmentId'],
          references: { schema: 'public', table: 'Assignment', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'HintEvent',
        foreignKey: {
          name: 'HintEvent_sessionId_fkey',
          columns: ['sessionId'],
          references: { schema: 'public', table: 'HelpSession', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'MaterialSection',
        foreignKey: {
          name: 'MaterialSection_materialId_fkey',
          columns: ['materialId'],
          references: { schema: 'public', table: 'TeacherMaterial', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'TeacherMaterial',
        foreignKey: {
          name: 'TeacherMaterial_classroomId_fkey',
          columns: ['classroomId'],
          references: { schema: 'public', table: 'Classroom', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);

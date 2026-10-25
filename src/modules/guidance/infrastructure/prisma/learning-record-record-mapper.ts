import { instantToDate } from '@lib/db';
import type { InstantRecord } from '@lib/db';

import { LEVEL_RECORD, STATUS_RECORD } from './help-session-record-mapper';

import type { SessionLearningRecord } from '../../domain/insights/learning-summary';
import type { HelpSessionStatus } from '../../domain/models/help-session';
import type { HintLevel } from '../../domain/models/hint-level';

const STATUS_BY_RECORD = new Map<string, HelpSessionStatus>(
  (Object.keys(STATUS_RECORD) as HelpSessionStatus[]).map((status) => [
    STATUS_RECORD[status],
    status,
  ]),
);
const LEVEL_BY_RECORD = new Map<string, HintLevel>(
  (Object.keys(LEVEL_RECORD) as HintLevel[]).map((level) => [LEVEL_RECORD[level], level]),
);

/** The columns of a child's session the summary reads; no text column among them. */
export interface ChildSessionRow {
  readonly id: string;
  readonly assignmentId: string | null;
  readonly competencyCode: string | null;
  readonly openTopicLabel: string | null;
  readonly status: string;
  readonly startedAt: InstantRecord;
}

export const toSessionStatus = (record: string): HelpSessionStatus | undefined =>
  STATUS_BY_RECORD.get(record);

/** A child's session row with its hint rungs; null for a status this code does not know. */
export function toSessionLearningRecord(
  session: ChildSessionRow,
  hintLevels: ReadonlyArray<{ readonly level: string }>,
  comprehensionAnswered: boolean,
): SessionLearningRecord | null {
  const status = toSessionStatus(session.status);
  if (status === undefined) {
    return null;
  }
  return {
    assignmentId: session.assignmentId,
    competencyCode: session.competencyCode,
    openTopicLabel: session.openTopicLabel,
    status,
    startedAt: instantToDate(session.startedAt),
    hintLevels: hintLevels.flatMap(({ level }) => {
      const known = LEVEL_BY_RECORD.get(level);
      return known === undefined ? [] : [known];
    }),
    comprehensionAnswered,
  };
}

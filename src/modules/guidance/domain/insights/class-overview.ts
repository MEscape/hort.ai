import type { HelpSessionStatus } from '../models/help-session';

/** Below this many children a class number is not shown, so no child can be singled out (#35). */
export const CLASS_MIN_GROUP = 3;

/** What the class overview may know of one help session on an assignment: no names, no texts. */
export interface ClassSessionRecord {
  readonly assignmentId: string;
  readonly childProfileId: string;
  readonly status: HelpSessionStatus;
  readonly hintCount: number;
}

export interface ClassAssignment {
  readonly id: string;
  readonly title: string;
}

/**
 * One assignment's class numbers. `too_few` covers zero to two children alike, so the overview
 * never tells whether one single child worked on it.
 */
export type AssignmentLearningStats =
  | { readonly kind: 'too_few'; readonly assignmentId: string; readonly title: string }
  | {
      readonly kind: 'shown';
      readonly assignmentId: string;
      readonly title: string;
      /** Children with at least one help session on it. */
      readonly children: number;
      /** Of them, children who finished it at least once. */
      readonly completed: number;
      /** The median of the hints each child needed on it, over all their sessions. */
      readonly medianHints: number;
    };

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length === 0) {
    return 0;
  }
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function statsOf(
  assignment: ClassAssignment,
  records: readonly ClassSessionRecord[],
): AssignmentLearningStats {
  const byChild = new Map<string, { hints: number; completed: boolean }>();
  for (const record of records) {
    const child = byChild.get(record.childProfileId) ?? { hints: 0, completed: false };
    byChild.set(record.childProfileId, {
      hints: child.hints + record.hintCount,
      completed: child.completed || record.status === 'completed',
    });
  }
  const base = { assignmentId: assignment.id, title: assignment.title };
  if (byChild.size < CLASS_MIN_GROUP) {
    return { kind: 'too_few', ...base };
  }
  const children = [...byChild.values()];
  return {
    kind: 'shown',
    ...base,
    children: children.length,
    completed: children.filter(({ completed }) => completed).length,
    medianHints: median(children.map(({ hints }) => hints)),
  };
}

/**
 * The teacher's class overview (#35): per assignment of the class, numbers over its children only.
 * A record of an assignment that is not listed is ignored.
 */
export function summarizeClass(
  assignments: readonly ClassAssignment[],
  records: readonly ClassSessionRecord[],
): AssignmentLearningStats[] {
  return assignments.map((assignment) =>
    statsOf(
      assignment,
      records.filter(({ assignmentId }) => assignmentId === assignment.id),
    ),
  );
}

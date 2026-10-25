import { PARENT_HINT_LEVELS } from '../../domain/models/parent-learning';
import { parentDay } from '../../domain/models/parent-period';

import type {
  ParentLearningMetrics,
  ParentLearningRecords,
  ParentPeriod,
} from '../contracts/parent-learning-views';

/** Counts recorded facts only; task status is a current snapshot, not an event history. */
export function aggregateParentLearning(
  records: ParentLearningRecords,
  period: ParentPeriod,
): ParentLearningMetrics {
  const { tasks } = records;
  const hintKnown = tasks.filter((task) => task.hintCount !== null);
  const knownHints = hintKnown.map((task) => task.hintCount ?? 0);
  const answerKnown = tasks.flatMap((task) => (task.answers === null ? [] : [task.answers]));
  const subjects = new Map<ParentLearningMetrics['subjects'][number]['subject'], number>();
  const hints = new Map<number, number>();
  const outcomes = period.days.map((day) => ({ day, ACTIVE: 0, COMPLETED: 0, ABANDONED: 0 }));
  for (const task of tasks) {
    const day = outcomes.find((row) => row.day === parentDay(task.startedAt));
    if (day) {
      day[task.status] += 1;
    }
    subjects.set(task.subject, (subjects.get(task.subject) ?? 0) + 1);
  }
  for (const count of knownHints) {
    hints.set(count, (hints.get(count) ?? 0) + 1);
  }
  return {
    total: tasks.length,
    completed: tasks.filter((task) => task.status === 'COMPLETED').length,
    active: tasks.filter((task) => task.status === 'ACTIVE').length,
    abandoned: tasks.filter((task) => task.status === 'ABANDONED').length,
    hintedTasks: knownHints.filter((count) => count > 0).length,
    hintTotal: knownHints.reduce((sum, count) => sum + count, 0),
    insightTasks: knownHints.length,
    answeredTasks: tasks.filter(
      (task) => task.questionsAnswered !== null && task.questionsAnswered > 0,
    ).length,
    answerKnownTasks: answerKnown.length,
    ownAnswerTasks: answerKnown.filter((answers) => answers.given > 0).length,
    correctTasks: answerKnown.filter((answers) => answers.results.CORRECT > 0).length,
    outcomes,
    subjects: Array.from(subjects, ([subject, count]) => ({ subject, count })),
    hintDistribution: Array.from(hints, ([count, countTasks]) => ({
      hints: count,
      tasks: countTasks,
    })).sort((a, b) => a.hints - b.hints),
    helpLevels:
      hintKnown.length === 0
        ? []
        : PARENT_HINT_LEVELS.map((level) => ({
            level,
            tasks: hintKnown.filter((task) => task.hintLevels.includes(level)).length,
          })),
  };
}

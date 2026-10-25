import { conceptTermsOf } from './subject-concepts';
import { stem, stemsMatch, termsOf } from './task-terms';

import type { CurriculumSubject } from '../models/curriculum-scope';

/** Anything retrieval can rank: an official competency or a teacher's material section. */
export interface RankableText {
  readonly code: string;
  readonly text: string;
  readonly section: string | null;
}

export interface RankingQuery {
  readonly task: string;
  readonly subject: CurriculumSubject;
  readonly limit: number;
}

/** Scores are rounded to three decimals so equal matches tie exactly. */
const SCORE_PRECISION = 1000;

export interface RankedText<T extends RankableText> {
  readonly item: T;
  readonly score: number;
}

/** The query: the task's own words plus the curriculum words its concepts imply. */
export function queryTermsOf(task: string, subject: CurriculumSubject): Set<string> {
  const terms = termsOf(task);
  for (const term of conceptTermsOf(task, subject)) {
    terms.add(stem(term));
  }
  return terms;
}

function matches(term: string, candidate: ReadonlySet<string>): boolean {
  for (const word of candidate) {
    if (stemsMatch(term, word)) {
      return true;
    }
  }
  return false;
}

/**
 * Ranks texts against a task by weighted term overlap (#28): each query term found in a text adds
 * its inverse document frequency over the candidates, so a rare, specific word ("Zeitspannen")
 * counts more than one that every competency shares. Texts without any match are left out: no
 * grounding is better than unrelated grounding. Ties keep a stable order by code.
 */
export function rankTexts<T extends RankableText>(
  { task, subject, limit }: RankingQuery,
  candidates: readonly T[],
): Array<RankedText<T>> {
  const query = queryTermsOf(task, subject);
  const termSets = candidates.map((item) => termsOf(`${item.section ?? ''} ${item.text}`));
  const weight = new Map<string, number>();
  for (const term of query) {
    const frequency = termSets.filter((terms) => matches(term, terms)).length;
    weight.set(term, frequency === 0 ? 0 : Math.log(1 + candidates.length / frequency));
  }
  return candidates
    .map((item, index) => {
      const terms = termSets[index] ?? new Set<string>();
      let score = 0;
      for (const term of query) {
        score += matches(term, terms) ? (weight.get(term) ?? 0) : 0;
      }
      return { item, score: Math.round(score * SCORE_PRECISION) / SCORE_PRECISION };
    })
    .filter((ranked) => ranked.score > 0)
    .sort((a, b) => b.score - a.score || a.item.code.localeCompare(b.item.code))
    .slice(0, limit);
}

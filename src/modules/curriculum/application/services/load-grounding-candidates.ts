import type { InfrastructureAppError } from '@lib/errors';
import { okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { CANDIDATES_MAX, MATERIAL_SECTIONS_MAX } from '../curriculum-limits';
import { fromCompetency, fromTeacherMaterial } from '../curriculum-view-mappers';

import type { CurriculumDependencies } from '../curriculum-dependencies';
import type { GroundingCandidate } from '../curriculum-view-mappers';
import type { RelevanceQuery } from './parse-relevance-query';

export interface GroundingCandidates {
  readonly candidates: readonly GroundingCandidate[];
  readonly usedFallback: boolean;
}

/**
 * Everything that may ground this child: the official competencies of the child's state and grade
 * (or, when the state has none, the documents valid in every state), plus the material of the
 * child's own class. Nothing of another state, grade or class is loaded.
 */
export function loadGroundingCandidates(
  deps: CurriculumDependencies,
  query: RelevanceQuery,
): AppResultAsync<GroundingCandidates, InfrastructureAppError> {
  const filter = { federalState: query.federalState, subject: query.subject, grade: query.grade };
  const official = deps.competencies
    .listCandidates(filter, CANDIDATES_MAX)
    .andThen((own) =>
      own.length > 0
        ? okAsync({ competencies: own, usedFallback: false })
        : deps.competencies
            .listCandidates({ ...filter, federalState: null }, CANDIDATES_MAX)
            .map((fallback) => ({ competencies: fallback, usedFallback: true })),
    );
  const material = query.classroomId
    ? deps.teacherMaterial.listForClassroom(query.classroomId, MATERIAL_SECTIONS_MAX)
    : okAsync([]);

  return official.andThen(({ competencies, usedFallback }) =>
    material.map((sections) => ({
      candidates: [...competencies.map(fromCompetency), ...sections.map(fromTeacherMaterial)],
      usedFallback,
    })),
  );
}

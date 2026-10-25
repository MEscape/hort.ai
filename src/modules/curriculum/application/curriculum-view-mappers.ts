import type { RelevantCompetencyView } from './contracts/curriculum-views';
import type { Competency, TeacherMaterialStatement } from '../domain/models/competency';
import type { RankedText } from '../domain/retrieval/rank-texts';

/** A competency or material section in the one shape retrieval ranks and answers with. */
export type GroundingCandidate = Omit<RelevantCompetencyView, 'score'>;

export function fromCompetency(competency: Competency): GroundingCandidate {
  const { document } = competency;
  return {
    code: `${document.sourceKey}@${document.version}:${competency.code}`,
    text: competency.text,
    section: competency.section,
    page: competency.page,
    origin: 'official',
    source: { key: document.sourceKey, title: document.title, url: document.sourceUrl },
  };
}

export function fromTeacherMaterial(statement: TeacherMaterialStatement): GroundingCandidate {
  return {
    code: `material:${statement.materialId}:${statement.code}`,
    text: statement.text,
    section: statement.section,
    page: statement.page,
    origin: 'teacher-material',
    source: { key: `material:${statement.materialId}`, title: statement.materialTitle, url: null },
  };
}

export function toRelevantCompetencyView({
  item,
  score,
}: RankedText<GroundingCandidate>): RelevantCompetencyView {
  return { ...item, score };
}

import type { RelevantCompetencyView } from './contracts/curriculum-views';
import type { Competency, TeacherMaterialStatement } from '../domain/models/competency';
import type { CompetencyRef } from '../domain/ports/competency.repository';
import type { RankedText } from '../domain/retrieval/rank-texts';

/** A competency or material section in the one shape retrieval ranks and answers with. */
export type GroundingCandidate = Omit<RelevantCompetencyView, 'score'>;

/** The view code of an official competency: `<sourceKey>@<version>:<code>`. */
export function competencyViewCode(competency: Competency): string {
  const { document } = competency;
  return `${document.sourceKey}@${document.version}:${competency.code}`;
}

/** The parts of an official view code; `null` for teacher material or a malformed code. */
export function parseCompetencyViewCode(viewCode: string): CompetencyRef | null {
  const at = viewCode.indexOf('@');
  const colon = viewCode.indexOf(':', at + 1);
  if (
    viewCode.startsWith('material:') ||
    at < 1 ||
    colon <= at + 1 ||
    colon === viewCode.length - 1
  ) {
    return null;
  }
  return {
    sourceKey: viewCode.slice(0, at),
    version: viewCode.slice(at + 1, colon),
    code: viewCode.slice(colon + 1),
  };
}

export function fromCompetency(competency: Competency): GroundingCandidate {
  const { document } = competency;
  return {
    code: competencyViewCode(competency),
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

import type { CompetencyTextLookup } from '../domain/ports/competency.repository';

/** What naming a stored competency (#35) is built from. */
export interface CompetencyTextDependencies {
  readonly texts: CompetencyTextLookup;
}

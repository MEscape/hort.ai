import type { TutorId } from '../models/ids';

/**
 * The companions a parent can choose for the child, owned by the tutors module. The learner module
 * only asks whether an id may be stored: unknown, draft and empty ids are refused.
 */
export interface TutorCatalogPort {
  isSelectable(id: TutorId): boolean;
}

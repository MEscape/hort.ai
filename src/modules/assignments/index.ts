/** Teacher storage is reached only through authorized use cases; preview components remain UI-only. */
/** @keep Server integration contract for the assignment posting workflow (#33). */
export { assignmentsQueries } from './composition';
export { AssignmentWorkspace } from './presentation/components/assignment-workspace';
export { ChildAssignmentPreview } from './presentation/components/child-assignment-preview';
export type { ChildAssignmentView } from './presentation/dto/child-assignment-dto';
export { default as enAssignments } from './presentation/i18n/en.json';
export { default as deAssignments } from './presentation/i18n/de.json';

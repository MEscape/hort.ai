/** Private teacher curriculum material, scoped to the teacher's own classroom. */
export { materialCommands, materialQueries } from './composition';
export { TeacherMaterialPanel } from './presentation/components/teacher-material-panel';
export type { BeginMaterialInput } from './application/contracts/material-inputs';
export type { MaterialView } from './application/contracts/material-views';
export { default as enTeacherMaterial } from './presentation/i18n/en.json';
export { default as deTeacherMaterial } from './presentation/i18n/de.json';

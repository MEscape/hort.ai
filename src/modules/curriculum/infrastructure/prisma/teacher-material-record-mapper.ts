import type { TeacherMaterialStatement } from '../../domain/models/competency';

export const TEACHER_MATERIAL_METADATA_SELECT = ['id', 'title'] as const;
export const TEACHER_MATERIAL_SECTION_SELECT = [
  'code',
  'text',
  'section',
  'page',
  'position',
] as const;

interface MaterialProjection {
  readonly id: string;
  readonly title: string;
  readonly sections: ReadonlyArray<{
    readonly code: string | null;
    readonly text: string;
    readonly section: string | null;
    readonly page: number | null;
    readonly position: number;
  }>;
}

/** Private persistence projection becomes the same citation contract as official curriculum. */
export function toTeacherMaterialStatements(
  material: MaterialProjection,
): TeacherMaterialStatement[] {
  return material.sections.map((section) => ({
    code: section.code ?? `s-${section.position}`,
    text: section.text,
    section: section.section,
    page: section.page,
    materialId: material.id,
    materialTitle: material.title,
  }));
}

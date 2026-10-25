import { materialQueries } from '../../composition';

import { TeacherMaterialSection } from './teacher-material-section';

/**
 * The class page's material section. The list query authorizes the class's own teacher; for
 * anyone else (or when the list cannot load) the section is simply not shown, so the rest of
 * the class page keeps working.
 */
export async function TeacherMaterialPanel({ classroomId }: { readonly classroomId: string }) {
  const result = await materialQueries.listMaterials.execute(classroomId);
  if (result.isErr()) {
    return null;
  }
  return <TeacherMaterialSection classroomId={classroomId} materials={result.value} />;
}

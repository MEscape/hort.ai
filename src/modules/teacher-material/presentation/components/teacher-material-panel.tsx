import { Alert, AlertDescription } from '@components/ui/alert';
import { Card, CardContent, CardHeader } from '@components/ui/card';
import { Info } from '@components/ui/icons';

import { getTranslations } from '@i18n/server';

import { materialQueries } from '../../composition';

import { TeacherMaterialSection } from './teacher-material-section';

/** Failures that mean "not this account's class": the section is not shown at all. */
const NOT_THEIRS = new Set(['unauthorized', 'forbidden', 'not_found']);

/**
 * The class page's material section. The list query authorizes the class's own teacher; for
 * anyone else the section is simply not shown. When the list cannot load, a calm notice says so,
 * and the rest of the class page keeps working.
 */
export async function TeacherMaterialPanel({ classroomId }: { readonly classroomId: string }) {
  const result = await materialQueries.listMaterials.execute(classroomId);
  if (result.isOk()) {
    return <TeacherMaterialSection classroomId={classroomId} materials={result.value} />;
  }
  if (NOT_THEIRS.has(result.error.kind)) {
    return null;
  }
  const t = await getTranslations('teacherMaterial.section');
  return (
    <Card>
      <CardHeader>
        <h2 className="font-heading text-2xl text-copy">{t('title')}</h2>
      </CardHeader>
      <CardContent>
        <Alert variant="info" role="status">
          <Info aria-hidden="true" />
          <AlertDescription>{t('unavailable')}</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

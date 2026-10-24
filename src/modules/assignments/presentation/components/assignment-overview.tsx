import { Hort } from '@components/brand/hort';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';

import { useTranslations } from '@i18n/client';

import { useFocusOnMount } from '@/hooks/use-focus-on-mount';

import { AssignmentList } from './assignment-list';
import { ConfirmPrompt } from './confirm-prompt';

import type { TeacherAssignmentView } from '../../application/contracts/assignment-views';
import type { AssignmentWorkspaceState } from '../hooks/use-assignment-workspace';

interface AssignmentOverviewProps {
  readonly classroomName: string;
  readonly assignments: readonly TeacherAssignmentView[];
  readonly state: AssignmentWorkspaceState;
}

/** The saved assignments of one class, with creation, editing and confirmed deletion. */
export function AssignmentOverview({ classroomName, assignments, state }: AssignmentOverviewProps) {
  const t = useTranslations('assignments');
  const headingRef = useFocusOnMount<HTMLHeadingElement>(true);
  const { deletion } = state;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 ref={headingRef} tabIndex={-1} className="font-heading text-3xl text-copy sm:text-4xl">
          {t('overview.title', { classroom: classroomName })}
        </h1>
        <Button type="button" onClick={state.openNew} disabled={deletion.isDeleting}>
          {t('overview.create')}
        </Button>
      </div>
      {deletion.target !== null && (
        <ConfirmPrompt
          title={t('delete.title', { title: deletion.target.title })}
          body={t('delete.body')}
          keepLabel={t('delete.keep')}
          confirmLabel={t('delete.confirm')}
          pendingLabel={deletion.isDeleting ? t('delete.deleting') : undefined}
          error={state.errorText(deletion.errorCode)}
          onKeep={deletion.cancel}
          onConfirm={deletion.confirm}
        />
      )}
      {assignments.length === 0 ? (
        <Card>
          <CardContent className="items-center gap-3 py-12 text-center sm:py-16">
            <Hort mood="think" className="size-20" />
            <h2 className="font-heading text-2xl text-copy">{t('overview.emptyTitle')}</h2>
            <p className="max-w-md text-copy-muted">{t('overview.emptyBody')}</p>
          </CardContent>
        </Card>
      ) : (
        <AssignmentList
          assignments={assignments}
          onEdit={state.openEdit}
          onDelete={deletion.request}
          isBusy={deletion.target !== null}
        />
      )}
    </section>
  );
}

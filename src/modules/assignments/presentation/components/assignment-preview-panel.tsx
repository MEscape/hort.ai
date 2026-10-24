import { Button } from '@components/ui/button';
import { ArrowLeft } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useFocusOnMount } from '@/hooks/use-focus-on-mount';

import { ChildAssignmentPreview } from './child-assignment-preview';

import type { ChildAssignmentView } from '../dto/child-assignment-dto';

interface AssignmentPreviewPanelProps {
  readonly assignment: ChildAssignmentView;
  readonly onEdit: () => void;
  readonly onBack: () => void;
  readonly isDiscarding: boolean;
}

export function AssignmentPreviewPanel({
  assignment,
  onEdit,
  onBack,
  isDiscarding,
}: AssignmentPreviewPanelProps) {
  const t = useTranslations('assignments');
  const headingRef = useFocusOnMount<HTMLHeadingElement>(true);

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 ref={headingRef} tabIndex={-1} className="font-heading text-3xl text-copy">
          {t('preview.title')}
        </h1>
        <p className="text-copy-muted">{t('preview.description')}</p>
      </div>
      <ChildAssignmentPreview assignment={assignment} />
      <div className="flex flex-wrap justify-between gap-3">
        <Button type="button" variant="ghost" onClick={onBack}>
          {t('preview.overview')}
        </Button>
        <Button type="button" variant="outline" disabled={isDiscarding} onClick={onEdit}>
          <ArrowLeft aria-hidden="true" />
          {t('preview.edit')}
        </Button>
      </div>
    </section>
  );
}

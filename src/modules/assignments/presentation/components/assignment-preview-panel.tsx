import { Button } from '@components/ui/button';
import { ArrowLeft } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useFocusOnMount } from '@/hooks/use-focus-on-mount';

import { ChildAssignmentPreview } from './child-assignment-preview';

import type { ChildAssignmentContent } from '../dto/child-assignment-dto';
import type { AssignmentEditorState } from '../hooks/use-assignment-editor';

interface AssignmentPreviewPanelProps {
  /** Only the child projection of the draft; the solution key never reaches this panel. */
  readonly assignment: ChildAssignmentContent;
  readonly editor: AssignmentEditorState;
}

export function AssignmentPreviewPanel({ assignment, editor }: AssignmentPreviewPanelProps) {
  const t = useTranslations('assignments');
  const headingRef = useFocusOnMount<HTMLHeadingElement>(true);
  const isBlocked = editor.isDiscarding || editor.isSaving;

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
        <Button
          type="button"
          variant="ghost"
          disabled={editor.isSaving}
          onClick={editor.requestOverview}
        >
          {t('preview.overview')}
        </Button>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={isBlocked}
            onClick={editor.returnToEditor}
          >
            <ArrowLeft aria-hidden="true" />
            {t('preview.edit')}
          </Button>
          <Button
            type="button"
            disabled={isBlocked}
            aria-busy={editor.isSaving}
            onClick={editor.onSave}
          >
            {editor.isSaving ? t('form.saving') : t('form.save')}
          </Button>
        </div>
      </div>
    </section>
  );
}

'use client';

import { Hort } from '@components/brand/hort';
import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { Info } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useFocusOnMount } from '@/hooks/use-focus-on-mount';

import { useAssignmentDraft } from '../hooks/use-assignment-draft';

import { AssignmentForm } from './assignment-form';
import { AssignmentPreviewPanel } from './assignment-preview-panel';
import { DiscardDraftPrompt } from './discard-draft-prompt';

/** Development workspace for a single temporary draft; it never fetches or claims to save assignments. */
export function AssignmentWorkspace() {
  const t = useTranslations('assignments');
  const state = useAssignmentDraft();
  const headingRef = useFocusOnMount<HTMLHeadingElement>(state.view === 'overview');

  return (
    <div className="space-y-6">
      <Alert variant="warning" role="note">
        <Info aria-hidden="true" />
        <AlertTitle>{t('development.title')}</AlertTitle>
        <AlertDescription>{t('development.body')}</AlertDescription>
      </Alert>
      {state.view === 'overview' && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="font-heading text-3xl text-copy sm:text-4xl"
            >
              {t('overview.title')}
            </h1>
            <Button type="button" onClick={state.openEditor}>
              {t('overview.create')}
            </Button>
          </div>
          <Card>
            <CardContent className="items-center gap-3 py-12 text-center sm:py-16">
              <Hort mood="think" className="size-20" />
              <h2 className="font-heading text-2xl text-copy">{t('overview.emptyTitle')}</h2>
              <p className="max-w-md text-copy-muted">{t('overview.emptyBody')}</p>
            </CardContent>
          </Card>
        </section>
      )}
      {state.view === 'edit' && <AssignmentForm state={state} />}
      {state.view === 'preview' && state.preview !== null && (
        <AssignmentPreviewPanel
          assignment={state.preview}
          onEdit={state.openEditor}
          onBack={state.requestOverview}
          isDiscarding={state.isDiscarding}
        />
      )}
      {state.isDiscarding && (
        <DiscardDraftPrompt onKeep={state.keepDraft} onDiscard={state.discardDraft} />
      )}
    </div>
  );
}

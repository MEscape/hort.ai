import { useId } from 'react';

import { useFormState } from 'react-hook-form';

import { TextField } from '@components/shared/text-field';
import { Button } from '@components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@components/ui/card';
import { Eye, Lock } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useFocusOnMount } from '@/hooks/use-focus-on-mount';

import { ASSIGNMENT_DRAFT_LIMITS } from '../schemas/assignment-draft-schema';

import { AssignmentTextArea } from './assignment-text-area';

import type { AssignmentDraftState } from '../hooks/use-assignment-draft';

interface AssignmentFormProps {
  readonly state: AssignmentDraftState;
}

export function AssignmentForm({ state }: AssignmentFormProps) {
  const t = useTranslations('assignments');
  const id = useId();
  const headingRef = useFocusOnMount<HTMLHeadingElement>(true);
  const { form, errorText } = state;
  // Subscribe here: React Compiler can reuse this component while the stable form object changes internally.
  const { errors } = useFormState({ control: form.control });

  return (
    <Card>
      <form onSubmit={state.onPreview} noValidate>
        <CardHeader className="items-start text-left">
          <h1 ref={headingRef} tabIndex={-1} className="font-heading text-3xl text-copy">
            {t('form.title')}
          </h1>
          <p className="text-base text-copy-muted">{t('form.requiredNote')}</p>
        </CardHeader>
        <CardContent>
          <fieldset disabled={state.isDiscarding} className="grid min-w-0 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <TextField
                id={`${id}-title`}
                label={t('form.titleLabel')}
                required
                maxLength={ASSIGNMENT_DRAFT_LIMITS.title}
                hint={t('form.titleHint', { limit: ASSIGNMENT_DRAFT_LIMITS.title })}
                error={errorText(errors.title?.message)}
                autoComplete="off"
                {...form.register('title')}
              />
              <AssignmentTextArea
                id={`${id}-task`}
                label={t('form.taskLabel')}
                required
                rows={8}
                maxLength={ASSIGNMENT_DRAFT_LIMITS.taskText}
                hint={t('form.taskHint', { limit: ASSIGNMENT_DRAFT_LIMITS.taskText })}
                error={errorText(errors.taskText?.message)}
                {...form.register('taskText')}
              />
            </div>
            <div className="space-y-6">
              <TextField
                id={`${id}-due`}
                type="date"
                label={t('form.dueLabel')}
                hint={t('form.dueHint')}
                error={errorText(errors.dueDate?.message)}
                {...form.register('dueDate')}
              />
              <div className="space-y-3 rounded-token-lg bg-sunken p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-primary-copy">
                  <Lock className="size-4" aria-hidden="true" />
                  {t('form.teacherOnly')}
                </p>
                <AssignmentTextArea
                  id={`${id}-solution`}
                  label={t('form.solutionLabel')}
                  rows={4}
                  maxLength={ASSIGNMENT_DRAFT_LIMITS.solutionKey}
                  hint={t('form.solutionHint', { limit: ASSIGNMENT_DRAFT_LIMITS.solutionKey })}
                  error={errorText(errors.solutionKey?.message)}
                  autoComplete="off"
                  {...form.register('solutionKey')}
                />
              </div>
            </div>
          </fieldset>
        </CardContent>
        <CardFooter className="justify-between gap-3">
          <Button type="button" variant="ghost" onClick={state.requestOverview}>
            {t('form.cancel')}
          </Button>
          <Button type="submit" disabled={state.isDiscarding}>
            <Eye aria-hidden="true" />
            {t('form.preview')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

'use client';

import { useId } from 'react';

import { useFormState } from 'react-hook-form';

import { TextField } from '@components/shared/text-field';
import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { TriangleAlert } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useChildClassroom } from '../hooks/use-child-classroom';

interface ChildClassroomPanelProps {
  /** The signed-in parent's own child, as the server loaded it. */
  readonly childProfileId: string;
  readonly childName: string;
  /** The child's current class, or `null` when it is in none. */
  readonly classroom: { readonly name: string; readonly grade: number } | null;
}

/**
 * The parent's view of their child's class: join one with the teacher's invite code, or see the
 * current one and leave it after confirming. A child is in at most one class; joining another is
 * refused by the server, never done silently.
 */
export function ChildClassroomPanel({
  childProfileId,
  childName,
  classroom,
}: ChildClassroomPanelProps) {
  const t = useTranslations('classroom');
  const id = useId();
  const state = useChildClassroom(childProfileId);
  const { errors } = useFormState({ control: state.form.control });

  return (
    <section aria-labelledby={`${id}-title`} className="w-full space-y-3 text-left">
      <h2 id={`${id}-title`} className="font-heading text-xl text-copy">
        {t('join.title')}
      </h2>
      {state.formError !== undefined && (
        <Alert variant="nudge" role="alert">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}
      {classroom === null ? (
        <form onSubmit={state.onJoin} noValidate aria-busy={state.isPending} className="space-y-3">
          <p className="text-copy-muted">{t('join.body', { name: childName })}</p>
          <TextField
            id={`${id}-code`}
            label={t('join.codeLabel')}
            hint={t('join.codeHint')}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={state.isPending}
            error={state.errorText(errors.inviteCode?.message)}
            {...state.form.register('inviteCode')}
          />
          <Button type="submit" disabled={state.isPending}>
            {state.isPending ? t('join.submitting') : t('join.submit')}
          </Button>
        </form>
      ) : (
        <div className="space-y-3">
          <p role="status" className="text-copy">
            {t('join.current', {
              name: childName,
              classroom: classroom.name,
              grade: classroom.grade,
            })}
          </p>
          {state.isConfirmingLeave ? (
            <Alert variant="warning">
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>{t('join.leaveTitle', { classroom: classroom.name })}</AlertTitle>
              <AlertDescription>
                <p>{t('join.leaveBody', { name: childName })}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={state.isPending}
                    onClick={state.cancelLeave}
                  >
                    {t('join.leaveKeep')}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={state.isPending}
                    onClick={state.confirmLeave}
                  >
                    {state.isPending ? t('join.leaving') : t('join.leaveConfirm')}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <Button type="button" variant="ghost" onClick={state.requestLeave}>
              {t('join.leave')}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

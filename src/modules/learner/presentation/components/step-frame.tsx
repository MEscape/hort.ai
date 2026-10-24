'use client';

import type { BaseSyntheticEvent, ReactNode } from 'react';

import { FormAlert } from '@components/shared/form-alert';
import { SubmitButton } from '@components/shared/submit-button';
import { Button } from '@components/ui/button';
import { Card } from '@components/ui/card';
import { ArrowLeft } from '@components/ui/icons';

import { useFocusOnMount } from '@hooks/use-focus-on-mount';

import { useTranslations } from '@i18n/client';

export interface StepFrameProps {
  /** The number in the badge: where this step sits in the journey. */
  readonly stepNumber: number;
  readonly title: string;
  readonly description?: string;
  /** Take focus when the step appears after the parent moved: the old step's button is gone. */
  readonly shouldTakeFocus: boolean;
  readonly onSubmit: (event?: BaseSyntheticEvent) => void | Promise<void>;
  readonly isPending?: boolean;
  /** Why the step was refused as a whole (a failed save), above the buttons where the eye is. */
  readonly formError?: string | undefined;
  readonly submitLabel: string;
  readonly pendingLabel?: string;
  /** Replaces the main button, for a step that ends in a link instead of a save. */
  readonly primary?: ReactNode;
  readonly onBack?: () => void;
  /** A quiet extra action next to Back, such as "Skip for now". */
  readonly secondary?: ReactNode;
  readonly children: ReactNode;
}

/**
 * The one frame of every setup step, so the steps look and behave alike: a numbered badge with the
 * heading and one calm sentence, the content, and a footer with the way back on the left and the one
 * main action on the right. The frame is a form: Enter submits, a second tap while saving does
 * nothing, and a failed save is said above the buttons without losing what was typed.
 */
export function StepFrame({
  stepNumber,
  title,
  description,
  shouldTakeFocus,
  onSubmit,
  isPending = false,
  formError,
  submitLabel,
  pendingLabel,
  primary,
  onBack,
  secondary,
  children,
}: StepFrameProps) {
  const t = useTranslations('learner');
  const headingRef = useFocusOnMount<HTMLHeadingElement>(shouldTakeFocus);

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={isPending}>
      <Card>
        <header className="flex items-start gap-4 px-6 pt-7 sm:px-10 sm:pt-9">
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-token bg-primary font-heading text-xl font-semibold text-primary-foreground shadow-soft"
          >
            {stepNumber}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 ref={headingRef} tabIndex={-1} className="text-2xl wrap-anywhere sm:text-3xl">
              {title}
            </h1>
            {description !== undefined && (
              <p className="measure text-lead text-copy-muted">{description}</p>
            )}
          </div>
        </header>
        <fieldset disabled={isPending} className="flex min-w-0 flex-col gap-6 px-6 py-6 sm:px-10">
          {children}
          <FormAlert id={`step-${stepNumber}-error`} message={formError} />
        </fieldset>
        <footer className="flex flex-col-reverse gap-3 rounded-b-token-xl border-t border-border bg-highlight/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {onBack !== undefined && (
              <Button type="button" variant="ghost" disabled={isPending} onClick={onBack}>
                <ArrowLeft aria-hidden="true" />
                {t('actions.back')}
              </Button>
            )}
            {secondary}
          </div>
          {primary ?? (
            <SubmitButton
              isPending={isPending}
              label={submitLabel}
              pendingLabel={pendingLabel ?? t('actions.saving')}
              className="sm:w-auto sm:min-w-48"
            />
          )}
        </footer>
      </Card>
    </form>
  );
}

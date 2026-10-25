import { useEffect, useRef } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { TriangleAlert } from '@components/ui/icons';

import { useFocusOnMount } from '@/hooks/use-focus-on-mount';

interface ConfirmPromptProps {
  readonly title: string;
  readonly body: string;
  readonly keepLabel: string;
  readonly confirmLabel: string;
  readonly onKeep: () => void;
  readonly onConfirm: () => void;
  /** While the confirmed action runs: both buttons are disabled and the confirm button says so. */
  readonly pendingLabel?: string | undefined;
  readonly error?: string | undefined;
}

/**
 * Inline confirmation for a step that loses work (discarding a draft, deleting an assignment).
 * The safe choice gets focus first; closing restores focus to the control that opened it.
 */
export function ConfirmPrompt({
  title,
  body,
  keepLabel,
  confirmLabel,
  onKeep,
  onConfirm,
  pendingLabel,
  error,
}: ConfirmPromptProps) {
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      returnFocus.current?.focus();
    };
  }, []);
  const keepRef = useFocusOnMount<HTMLButtonElement>(true);
  const isPending = pendingLabel !== undefined;

  return (
    <Alert variant="warning">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{body}</p>
        {error !== undefined && (
          <p role="alert" className="mt-2 font-semibold">
            {error}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-3">
          <Button
            ref={keepRef}
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={onKeep}
          >
            {keepLabel}
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={isPending}
            aria-busy={isPending}
            onClick={onConfirm}
          >
            {pendingLabel ?? confirmLabel}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

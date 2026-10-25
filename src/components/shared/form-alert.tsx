'use client';

import { Alert, AlertDescription } from '@components/ui/alert';
import { Lightbulb } from '@components/ui/icons';

import { useFocusOnMount } from '@hooks/use-focus-on-mount';

export interface FormAlertProps {
  readonly id: string;
  /** The translated reason the form was refused; nothing is drawn without one. */
  readonly message: string | undefined;
}

/**
 * Why the whole form was refused (wrong credentials, a failed save), above its button where the
 * eye is. It is a nudge, not an error: warm words, a lightbulb, and a role that makes screen
 * readers say it at once.
 */
export function FormAlert({ id, message }: FormAlertProps) {
  const alertRef = useFocusOnMount<HTMLDivElement>(message !== undefined);
  if (message === undefined) {
    return null;
  }
  return (
    <Alert ref={alertRef} tabIndex={-1} variant="nudge" id={id}>
      <Lightbulb aria-hidden="true" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

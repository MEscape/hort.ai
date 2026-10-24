import { Button } from '@components/ui/button';
import { Spinner } from '@components/ui/icons';

import { cn } from '@lib/utils';

export interface SubmitButtonProps {
  readonly isPending: boolean;
  readonly label: string;
  /** What it says while the request runs. */
  readonly pendingLabel: string;
  /** Overrides the full width, for a button that sits in a footer beside others. */
  readonly className?: string;
}

/**
 * The one big action of a form: full width, and busy while the request runs. It is disabled
 * while pending, so a second tap cannot send the form twice, and says what is happening.
 */
export function SubmitButton({ isPending, label, pendingLabel, className }: SubmitButtonProps) {
  return (
    <Button type="submit" size="lg" disabled={isPending} className={cn('w-full', className)}>
      {isPending && <Spinner className="animate-spin" aria-hidden="true" />}
      {isPending ? pendingLabel : label}
    </Button>
  );
}

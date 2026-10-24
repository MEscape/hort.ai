import { Button } from '@components/ui/button';
import { Spinner } from '@components/ui/icons';

export interface AuthSubmitButtonProps {
  readonly isPending: boolean;
  readonly label: string;
  /** What it says while the request runs. */
  readonly pendingLabel: string;
}

/**
 * The one big action of an auth form: full width, and busy while the request runs. It is disabled
 * while pending, so a second tap cannot send the form twice, and says what is happening.
 */
export function AuthSubmitButton({ isPending, label, pendingLabel }: AuthSubmitButtonProps) {
  return (
    <Button type="submit" size="lg" disabled={isPending} className="w-full">
      {isPending && <Spinner className="animate-spin" aria-hidden="true" />}
      {isPending ? pendingLabel : label}
    </Button>
  );
}

export interface NextStep {
  readonly title: string;
  readonly description: string;
}

export interface NextStepsProps {
  /** What the list is about, for screen readers ("What happens next"). */
  readonly label: string;
  readonly steps: readonly NextStep[];
}

/**
 * "What happens next" as a short numbered list. The list is an `ol`, so its order is announced; the
 * round numbers are decoration, hidden from assistive technology so they are not read twice.
 */
export function NextSteps({ label, steps }: NextStepsProps) {
  return (
    <ol aria-label={label} className="flex flex-col gap-4 rounded-token-lg bg-highlight/60 p-4">
      {steps.map((step, index) => (
        <li key={step.title} className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-primary font-heading text-lg font-semibold text-primary-foreground"
          >
            {index + 1}
          </span>
          <div className="flex flex-col">
            <p className="font-heading text-lg font-semibold">{step.title}</p>
            <p className="text-copy-muted">{step.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

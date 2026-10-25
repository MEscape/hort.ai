import { useId } from 'react';
import type { ReactNode } from 'react';

/** A meaningful section of the parent overview, with consistent heading, description and spacing. */
export function ParentPanel({
  title,
  description,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="min-w-0 rounded-token-xl border border-border bg-surface p-5 shadow-soft sm:p-6"
    >
      <h2 id={id} className="font-heading text-2xl font-medium text-copy">
        {title}
      </h2>
      {description && (
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-copy-muted">{description}</p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

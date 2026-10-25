import { cn } from '@lib/utils';

const TAIL = {
  /** Over the companion: the tail points down to it. */
  down: 'after:top-full after:left-1/2 after:-mt-2.5 after:-translate-x-1/2 after:rounded-br-sm after:border-r-2 after:border-b-2',
  /** Beside the companion on its left: the tail points left to it. */
  left: 'after:top-1/2 after:right-full after:-mr-2.5 after:-translate-y-1/2 after:rounded-bl-sm after:border-b-2 after:border-l-2',
} as const;

export interface SpeechBubbleProps {
  /** What the companion says: one short line. A new line pops in again. */
  readonly text: string;
  /** True when the line changes in answer to the child, so a screen reader says it too. */
  readonly isLive?: boolean;
  readonly tail?: keyof typeof TAIL;
  readonly className?: string;
}

/** The companion's one line, in a rounded bubble whose tail points to the companion. */
export function SpeechBubble({
  text,
  isLive = false,
  tail = 'down',
  className,
}: SpeechBubbleProps) {
  return (
    <div role={isLive ? 'status' : undefined} className={cn('max-w-full', className)}>
      <p
        key={text}
        className={cn(
          "relative animate-pop rounded-token-xl border-2 border-border bg-surface px-5 py-3 text-center font-heading text-xl font-semibold text-balance text-copy shadow-soft after:absolute after:size-4 after:rotate-45 after:border-border after:bg-surface after:content-[''] sm:text-2xl",
          TAIL[tail],
        )}
      >
        {text}
      </p>
    </div>
  );
}

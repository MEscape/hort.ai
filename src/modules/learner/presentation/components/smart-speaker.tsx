export interface SmartSpeakerProps {
  readonly className?: string;
}

/**
 * An original drawing of a smart speaker: a plain round body with a ring of light on top and sound
 * arcs that pulse. It is deliberately not the look of any product, brand or logo (those are not ours
 * to use): the colours are Hortai's tokens, the shape is a generic puck. Decorative; the screen's
 * words say what it is for.
 */
export function SmartSpeaker({ className }: SmartSpeakerProps) {
  return (
    <svg viewBox="0 0 220 170" aria-hidden="true" focusable="false" className={className}>
      <ellipse cx="96" cy="154" rx="62" ry="9" className="fill-copy/10" />
      <path d="M38 70a58 23 0 0 1 116 0v54a58 23 0 0 1-116 0z" className="fill-copy" />
      <path d="M46 84v38a52 19 0 0 0 14 8V88z" className="fill-primary-foreground/10" />
      <ellipse cx="96" cy="70" rx="58" ry="23" className="fill-copy" />
      <ellipse cx="96" cy="70" rx="58" ry="23" className="fill-primary-foreground/15" />
      <ellipse
        cx="96"
        cy="70"
        rx="42"
        ry="15"
        fill="none"
        strokeWidth="6"
        className="stroke-accent"
      />
      <ellipse cx="96" cy="70" rx="24" ry="8" className="fill-primary-foreground/10" />
      <g fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-accent">
        <path d="M168 60q13 12 0 24" className="motion-safe:animate-pulse" />
        <path d="M182 48q24 24 0 48" opacity="0.65" />
        <path d="M196 36q34 36 0 72" opacity="0.35" />
      </g>
    </svg>
  );
}

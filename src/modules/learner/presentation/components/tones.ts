/**
 * The colours of an icon tile, from the design tokens. A few tones keep the screens lively without
 * a new colour: sky for "who", amber for "time and warmth", bloom for "notes", green for safety.
 */
export const TONES = {
  sky: 'bg-secondary text-secondary-foreground',
  amber: 'bg-accent/30 text-accent-copy',
  bloom: 'bg-bloom/30 text-bloom-copy',
  green: 'bg-success-subtle text-success',
} as const;

export type Tone = keyof typeof TONES;

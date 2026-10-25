import type { ReactNode } from 'react';

import { cn } from '@lib/utils';

/** The banks take this share of the frame on each side; planks fill the deck between them. */
const BANK_SHARE = 0.1;

/** Where a share of the deck ends, as a share of the frame's width: hint lines line up on it. */
export function deckShare(share: number): number {
  return BANK_SHARE + (1 - 2 * BANK_SHARE) * share;
}

/**
 * A river between two grassy banks with a deck of equal plank slots: the stage both bridge
 * templates draw on. Colours come from the island world, so a lesson looks like the world it is in.
 */
export function BridgeFrame({ children }: { readonly children: ReactNode }) {
  return (
    <div className="relative h-28 w-full overflow-hidden rounded-token-lg bg-island-water sm:h-32">
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-island-water-light/50" />
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-1/10 rounded-r-token bg-island-leaf"
      />
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 w-1/10 rounded-l-token bg-island-leaf"
      />
      <div
        aria-hidden
        className="absolute inset-x-1/10 top-[calc(50%-1.9rem)] h-1 rounded-full bg-island-wood-shade/60"
      />
      <div className="absolute inset-x-1/10 top-1/2 flex h-11 -translate-y-1/2">{children}</div>
    </div>
  );
}

interface PlankProps {
  readonly laid: boolean;
  /** Shown on a laid plank while the companion counts along. */
  readonly number?: number | undefined;
}

/** One plank slot: laid wood or an empty dashed gap over the water. Each slot is exactly 1/parts wide. */
export function Plank({ laid, number }: PlankProps) {
  return (
    <span className="flex h-full flex-1 px-0.5">
      <span
        className={cn(
          'flex flex-1 items-center justify-center rounded-token-sm font-heading text-lg transition-colors',
          laid
            ? 'border-b-4 border-island-wood-shade bg-island-wood text-primary-foreground'
            : 'border-2 border-dashed border-island-wood/70',
        )}
      >
        {laid && number !== undefined ? number : null}
      </span>
    </span>
  );
}

/** A finished bridge picture: `laid` of `parts` planks from the left bank. */
export function StaticBridge({ parts, laid }: { readonly parts: number; readonly laid: number }) {
  return (
    <BridgeFrame>
      {Array.from({ length: parts }, (_, index) => (
        <Plank key={index} laid={index < laid} />
      ))}
    </BridgeFrame>
  );
}

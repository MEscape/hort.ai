'use client';

import type { GuideLayout } from './use-home-guide';

interface GuideLayerProps {
  readonly layout: GuideLayout | null;
  readonly text: string | null;
}

/** Only speech. The original companion remains mounted in its feeding stage. */
export function GuideLayer({ layout, text }: GuideLayerProps) {
  return (
    <>
      <p role="status" className="sr-only">
        {text}
      </p>
      {layout !== null && text !== null && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-30">
          <div
            className="absolute"
            style={{
              left: layout.bubble.x,
              top: layout.bubble.y,
              width: layout.bubble.width,
              transform: `translate(-50%, ${layout.bubble.isBelow ? '0' : '-100%'})`,
            }}
          >
            <p className="relative animate-pop rounded-token-xl border-2 border-border bg-surface px-4 py-2 text-center font-heading text-lg font-semibold text-balance text-copy shadow-lift">
              {text}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

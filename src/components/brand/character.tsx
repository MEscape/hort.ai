'use client';

import { useState, useSyncExternalStore } from 'react';

import { PawPrint } from '@components/ui/icons';

import { useLipSync } from '@hooks/use-lip-sync';

import { cn } from '@lib/utils';

const PERCENT = 100;

/** Nothing changes after hydration; the store only tells the server render from the browser's. */
const subscribeNever = () => () => undefined;

/**
 * How to lay the open-mouth picture exactly over the closed one when the two were exported with
 * different framing: a scale and a shift, as fractions of the picture's own square box. Without it
 * the swap between the pictures makes the character jump. The proper fix is to export both pictures
 * on the same canvas, then this is not needed.
 */
export interface MouthAlignment {
  readonly scaleX: number;
  readonly scaleY: number;
  readonly x: number;
  readonly y: number;
}

export interface CharacterProps {
  /** The closed-mouth picture (the one shown at rest). */
  readonly imageUrl: string;
  /** The open-mouth picture; without it the character cannot lip-sync and stays closed. */
  readonly openImageUrl?: string | undefined;
  /** Lays the open-mouth picture over the closed one when they are framed differently. */
  readonly openAlignment?: MouthAlignment | undefined;
  /** True while the character speaks: the mouth then alternates between the two pictures. */
  readonly isSpeaking?: boolean;
  /** The picture's alternative text; `""` when a name next to it already says who it is. */
  readonly alt: string;
  /** Size and placement. The picture is transparent, so it may overflow the box it stands in. */
  readonly className?: string;
}

/**
 * A talking character (Max, Lili, Fina, ...) for any screen: one picture at rest and the same
 * picture with an open mouth over it while `isSpeaking`. The pictures are stacked, so changing the
 * mouth never loads or re-lays-out anything and costs only an opacity change. The pictures are meant to be
 * transparent, so a character stands on whatever is behind it and may overflow its box. Until every
 * uploaded picture is transparent, one with a white background is only invisible on a white surface.
 * The closed picture hides while the open one shows, so the two never overlap. The mouth moves in an
 * uneven rhythm (`useLipSync`) and stays still with reduced motion. A missing picture (not uploaded,
 * offline) shows a calm paw instead of a broken-image icon. The component knows nothing about who
 * the character is: callers pass the addresses, so the catalog stays in its module.
 */
export function Character({
  imageUrl,
  openImageUrl,
  openAlignment,
  isSpeaking = false,
  alt,
  className,
}: CharacterProps) {
  const [hasFailed, setHasFailed] = useState(false);
  // An image that fails before hydration never reports it: draw the picture only once React listens.
  const isReady = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const isMouthOpen = useLipSync(isSpeaking && openImageUrl !== undefined);
  const showsPicture = !hasFailed && imageUrl !== '' && isReady;

  return (
    <span className={cn('relative inline-block size-24 select-none', className)}>
      {showsPicture ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG from public storage, not optimizable */}
          <img
            src={imageUrl}
            alt={alt}
            decoding="async"
            draggable={false}
            className={cn('size-full object-contain', isMouthOpen && 'opacity-0')}
            onError={() => {
              setHasFailed(true);
            }}
          />
          {openImageUrl !== undefined && (
            // eslint-disable-next-line @next/next/no-img-element -- SVG from public storage, not optimizable
            <img
              src={openImageUrl}
              alt=""
              aria-hidden="true"
              decoding="async"
              draggable={false}
              className={cn(
                'absolute inset-0 size-full object-contain',
                isMouthOpen ? 'opacity-100' : 'opacity-0',
              )}
              style={
                openAlignment === undefined
                  ? undefined
                  : {
                      transformOrigin: '0 0',
                      transform: `translate(${openAlignment.x * PERCENT}%, ${openAlignment.y * PERCENT}%) scale(${openAlignment.scaleX}, ${openAlignment.scaleY})`,
                    }
              }
            />
          )}
        </>
      ) : (
        <span className="flex size-full items-center justify-center rounded-token-lg bg-secondary text-secondary-copy">
          <PawPrint className="size-1/3" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}

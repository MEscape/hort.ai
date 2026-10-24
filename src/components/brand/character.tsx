'use client';

import { useState, useSyncExternalStore } from 'react';

import { PawPrint } from '@components/ui/icons';

import { useLipSync } from '@hooks/use-lip-sync';

import { cn } from '@lib/utils';

/** Nothing changes after hydration; the store only tells the server render from the browser's. */
const subscribeNever = () => () => undefined;

export interface CharacterProps {
  /** The closed-mouth picture (the one shown at rest). */
  readonly imageUrl: string;
  /** The open-mouth picture; without it the character cannot lip-sync and stays closed. */
  readonly openImageUrl?: string | undefined;
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
 * mouth never loads or re-lays-out anything and costs only an opacity change. The pictures come with an opaque
 * white background (until transparent ones exist), so give the character a rounded, clipped card
 * (`overflow-hidden rounded-token-lg bg-surface shadow-soft` through `className`) or stand it on white.
 * The closed picture hides while the open one shows, so the two never overlap. The mouth moves in an
 * uneven rhythm (`useLipSync`) and stays still with reduced motion. A missing picture (not uploaded,
 * offline) shows a calm paw instead of a broken-image icon. The component knows nothing about who
 * the character is: callers pass the addresses, so the catalog stays in its module.
 */
export function Character({
  imageUrl,
  openImageUrl,
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

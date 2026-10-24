'use client';

import { useState, useSyncExternalStore } from 'react';

import { PawPrint } from '@components/ui/icons';

import { cn } from '@lib/utils';

import { TONES } from './tones';

import type { Tone } from './tones';

/** Nothing changes after hydration; the store only tells the server render from the browser's. */
const subscribeNever = () => () => undefined;

export interface TutorAvatarProps {
  readonly imageUrl: string;
  readonly alt: string;
  readonly className?: string;
  /** The colour of the tile behind the picture while there is no picture. */
  readonly tone?: Tone;
  /** The open-mouth picture, given only once the companion speaks so it is not downloaded before. */
  readonly openImageUrl?: string | undefined;
  /** Shows the open mouth over the closed one; the two pictures are stacked, so nothing reloads. */
  readonly isMouthOpen?: boolean;
}

/**
 * A companion's picture. The picture lives in public storage and may be missing (not synced yet,
 * offline): then a calm paw tile takes its place, so a card never shows a broken-image icon and the
 * choice stays usable by its name alone. The open-mouth picture lies over the closed one and fades
 * in while the companion speaks.
 */
export function TutorAvatar({
  imageUrl,
  alt,
  className,
  tone = 'sky',
  openImageUrl,
  isMouthOpen = false,
}: TutorAvatarProps) {
  const [hasFailed, setHasFailed] = useState(false);
  // An image that fails before hydration never reports it: show the picture only once React listens.
  const isReady = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const showsPicture = !hasFailed && imageUrl !== '' && isReady;

  return (
    <span
      className={cn(
        'relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-token-lg',
        showsPicture ? 'border border-border bg-surface' : TONES[tone],
        className,
      )}
    >
      {showsPicture ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG from public storage, not optimizable */}
          <img
            src={imageUrl}
            alt={alt}
            width={96}
            height={96}
            className="size-full object-contain"
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
              width={96}
              height={96}
              className={cn(
                'absolute inset-0 size-full object-contain transition-opacity duration-75',
                isMouthOpen ? 'opacity-100' : 'opacity-0',
              )}
            />
          )}
        </>
      ) : (
        <PawPrint className="size-10" aria-hidden="true" />
      )}
    </span>
  );
}

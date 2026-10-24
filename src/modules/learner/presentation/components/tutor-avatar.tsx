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
  /** The colour of the tile behind the picture. */
  readonly tone?: Tone;
}

/**
 * A companion's picture. The picture lives in public storage and may be missing (not synced yet,
 * offline): then a calm paw tile takes its place, so a card never shows a broken-image icon and the
 * choice stays usable by its name alone.
 */
export function TutorAvatar({ imageUrl, alt, className, tone = 'sky' }: TutorAvatarProps) {
  const [hasFailed, setHasFailed] = useState(false);
  // An image that fails before hydration never reports it: show the picture only once React listens.
  const isReady = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  return (
    <span
      className={cn(
        'flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-token-lg',
        TONES[tone],
        className,
      )}
    >
      {hasFailed || imageUrl === '' || !isReady ? (
        <PawPrint className="size-10" aria-hidden="true" />
      ) : (
        // @ui-plain img Companion pictures are SVGs from public storage; they need no optimizer.
        // eslint-disable-next-line @next/next/no-img-element -- SVG from public storage, not optimizable
        <img
          src={imageUrl}
          alt={alt}
          width={96}
          height={96}
          loading="lazy"
          className="size-full object-contain"
          onError={() => {
            setHasFailed(true);
          }}
        />
      )}
    </span>
  );
}

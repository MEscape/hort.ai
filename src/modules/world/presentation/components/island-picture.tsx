'use client';

import { usePictureState } from '@components/brand/use-picture-state';

import { cn } from '@lib/utils';

import { islandOutline } from '../art/island-geometry';

import { IslandArt } from './island-art';
import styles from './island-picture.module.css';

import type { IslandPictureSource } from '../catalog/island-catalog';
import type { IslandArtDto } from '../dto/island-dto';

export interface IslandPictureProps {
  readonly art: IslandArtDto;
  readonly picture: IslandPictureSource | null;
  readonly sizes: string;
  readonly isPriority?: boolean;
  readonly className?: string;
  /** Unknown means the backend has supplied no discovery record; it never implies earned progress. */
  readonly discovery?: 'unknown' | 'revealed' | 'unrevealed';
}

/**
 * Shared art, loading and mist for Home, map and island. A failed request is never a discovery state.
 * Whether a picture is uploaded is not the child's concern: a missing or failed one quietly shows the
 * drawn island, and only `aria-busy` tells assistive technology that a picture is still loading.
 */
export function IslandPicture({
  art,
  picture,
  sizes,
  isPriority = false,
  className,
  discovery = 'unknown',
}: IslandPictureProps) {
  const { state, attach, markFailed, markReady } = usePictureState(picture?.src);
  const assetState = picture === null ? 'missing' : state;
  const outline = islandOutline(art.seed);
  return (
    <span
      data-asset-state={assetState}
      data-discovery={discovery}
      data-atmosphere={art.biome}
      aria-busy={assetState === 'pending'}
      className={cn(styles['picture'], 'relative block aspect-4/3 w-full', className)}
    >
      {picture === null || state === 'failed' ? (
        <IslandArt art={art} className="block size-full" />
      ) : (
        <>
          {state === 'pending' && (
            <svg
              aria-hidden="true"
              viewBox="0 0 400 300"
              className="absolute inset-0 size-full fill-secondary/50"
            >
              <path d={outline.underside} />
              <path d={outline.top} className="fill-secondary" />
            </svg>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- versioned, pre-cut WebP variants preserve the transparent island canvas */}
          <img
            ref={attach}
            src={picture.src}
            srcSet={picture.srcSet}
            sizes={sizes}
            alt=""
            width={1024}
            height={768}
            loading={isPriority ? 'eager' : 'lazy'}
            fetchPriority={isPriority ? 'high' : 'auto'}
            decoding="async"
            onLoad={markReady}
            onError={markFailed}
            className={cn(
              'relative block size-full object-contain transition-opacity duration-300',
              state === 'pending' && 'opacity-0',
            )}
          />
        </>
      )}
      <span
        aria-hidden="true"
        className={cn(
          styles['mist'],
          'pointer-events-none absolute inset-0 transition-opacity duration-700',
        )}
      />
    </span>
  );
}

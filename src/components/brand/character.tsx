'use client';

import type { CharacterExpression, CharacterFace } from '@components/brand/character-face';
import { CharacterFaceLayers } from '@components/brand/character-face-layers';
import { useCharacterView } from '@components/brand/use-character-view';
import { usePictureState } from '@components/brand/use-picture-state';
import { PawPrint } from '@components/ui/icons';

import { cn } from '@lib/utils';

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
  /** How the face looks (lids, happy eyes, chewing, yawning, slump). Needs `face` for anything on the eyes. */
  readonly expression?: CharacterExpression | undefined;
  /** Where the eyes are, from the tutor catalog. Without it the character is just the picture. */
  readonly face?: CharacterFace | undefined;
  /** `high` for the one character the screen is about. */
  readonly fetchPriority?: 'high' | 'low' | 'auto';
  /** Size and placement. The picture is transparent, so it may overflow the box it stands in. */
  readonly className?: string;
}

/**
 * A talking character (Max, Lili, Fina, ...) for any screen: one picture at rest and the same
 * picture with an open mouth over it while `isSpeaking`. The pictures are stacked, so changing the
 * mouth never loads or re-lays-out anything and costs only an opacity change. The pictures are
 * transparent, so a character stands on whatever is behind it and may overflow its box.
 * The closed picture hides while the open one shows, so the two never overlap. The mouth moves in an
 * uneven rhythm (`useLipSync`) and stays still with reduced motion. A missing picture (not uploaded,
 * offline) shows a calm paw (no background of its own) instead of a broken-image icon. The pictures
 * are in the server-rendered page too, so the browser fetches them before React runs. The component
 * knows nothing about who the character is: callers pass the addresses, so the catalog stays in its module.
 */
export function Character({
  imageUrl,
  openImageUrl,
  openAlignment,
  isSpeaking = false,
  expression,
  face,
  alt,
  fetchPriority,
  className,
}: CharacterProps) {
  const {
    state: closedState,
    attach: attachClosed,
    markFailed: markClosedFailed,
  } = usePictureState(imageUrl);
  const {
    state: openState,
    attach: attachOpen,
    markFailed: markOpenFailed,
  } = usePictureState(openImageUrl);
  const view = useCharacterView({
    isOpenReady: openState === 'ready',
    imageUrl,
    openImageUrl,
    openAlignment,
    isSpeaking,
    expression,
    face,
  });
  const { isMouthOpen, openFrame, alignmentStyle } = view;
  // The face overlay waits for the picture, so it never floats in empty space.
  const isFaceHidden = closedState === 'pending';

  return (
    <span className={cn('relative inline-block size-24 select-none', className)}>
      {closedState !== 'failed' && imageUrl !== '' ? (
        <span className="block size-full transition-transform ease-out" style={view.poseStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG from public storage, not optimizable */}
          <img
            ref={attachClosed}
            src={imageUrl}
            alt={alt}
            fetchPriority={fetchPriority}
            decoding="async"
            draggable={false}
            className={cn('size-full object-contain', isMouthOpen && 'opacity-0')}
            onError={markClosedFailed}
          />
          {view.hasOpenPicture && (
            // eslint-disable-next-line @next/next/no-img-element -- SVG from public storage, not optimizable
            <img
              ref={attachOpen}
              src={openImageUrl}
              alt=""
              aria-hidden="true"
              fetchPriority={fetchPriority}
              decoding="async"
              draggable={false}
              className={cn(
                'absolute inset-0 size-full object-contain',
                isMouthOpen ? 'opacity-100' : 'opacity-0',
              )}
              style={alignmentStyle}
              onError={markOpenFailed}
            />
          )}
          {face !== undefined && expression !== undefined && (
            <CharacterFaceLayers
              face={face}
              expression={expression}
              openFrame={openFrame}
              isMouthOpen={isMouthOpen}
              isHidden={isFaceHidden}
              openStyle={alignmentStyle}
            />
          )}
        </span>
      ) : (
        <span className="flex size-full items-center justify-center text-copy-muted">
          <PawPrint className="size-1/3" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}

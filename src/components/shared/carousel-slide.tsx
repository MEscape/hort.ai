'use client';

import type { CSSProperties } from 'react';

import type { MouthAlignment } from '@components/brand/character';
import type { CharacterFace } from '@components/brand/character-face';
import { SlideCharacter } from '@components/shared/slide-character';
import { Star } from '@components/ui/icons';

import { useHop } from '@hooks/use-carousel';

import { cn } from '@lib/utils';

export interface CarouselCharacter {
  readonly id: string;
  readonly name: string;
  /** The closed-mouth picture. */
  readonly imageUrl: string;
  /** The open-mouth picture, loaded only for the active character, which is the one that speaks. */
  readonly imageOpenUrl?: string | undefined;
  readonly openAlignment?: MouthAlignment | undefined;
  /** Where its eyes are, so it can blink and smile; without it the picture stays still. */
  readonly face?: CharacterFace | undefined;
  /** A short translated mark such as "Fits you": a star with text, never colour alone. */
  readonly badge?: string | undefined;
}

const NEIGHBOUR_SCALE = 0.56;
const NEIGHBOUR_OPACITY = 0.78;

/** Where a slide stands: the active one in the middle, the neighbours smaller and softer, the rest gone. */
function placement(offset: number): CSSProperties {
  const distance = Math.abs(offset);
  const opacity = distance > 1 ? 0 : NEIGHBOUR_OPACITY;
  return {
    opacity: distance === 0 ? 1 : opacity,
    transform: `translateX(-50%) translateX(calc(${offset} * var(--step) + var(--drag, 0px))) scale(${distance === 0 ? 1 : NEIGHBOUR_SCALE})`,
    zIndex: distance === 0 ? 1 : 0,
  };
}

export interface CarouselSlideProps {
  readonly character: CarouselCharacter;
  readonly id: string;
  /** Distance from the active character: 0 is the active one, -1 and 1 its neighbours. */
  readonly offset: number;
  readonly hopToken: number;
  readonly isCalm: boolean;
  readonly onSelect: () => void;
}

/**
 * One character on the stage, placed by its distance from the active one. Only the transform and
 * the opacity change, so a step is a slide, never a layout. The active one is big, bobs gently, hops
 * when chosen and carries the star mark; its big name is drawn by the carousel below the stage. The
 * others are small and softer, and stay tappable. The name is there for a screen reader. Characters two or more steps
 * away are only a fade away: hidden. Every picture is loaded at once (there are only a few), so a
 * character that becomes the active one is already there and never appears with a blank box.
 */
export function CarouselSlide({
  character,
  id,
  offset,
  hopToken,
  isCalm,
  onSelect,
}: CarouselSlideProps) {
  const isActive = offset === 0;
  const isNear = Math.abs(offset) <= 1;
  const hopRef = useHop(isActive && !isCalm ? hopToken : 0);

  return (
    // @ui-plain button The slide is an option of the carousel's listbox; its picture is the control.
    <button
      type="button"
      role="option"
      id={id}
      aria-selected={isActive}
      tabIndex={-1}
      onClick={onSelect}
      className={cn(
        'absolute bottom-0 left-1/2 block w-(--hero) origin-bottom',
        'transition-[transform,opacity] duration-500 ease-spring group-data-[dragging=true]:transition-none',
        !isNear && 'pointer-events-none',
      )}
      style={placement(offset)}
    >
      <span ref={hopRef} className="relative block origin-bottom">
        <span className={cn('block origin-bottom', isActive && !isCalm && 'animate-float')}>
          <SlideCharacter
            imageUrl={character.imageUrl}
            imageOpenUrl={character.imageOpenUrl}
            openAlignment={character.openAlignment}
            face={character.face}
            isActive={isActive}
            hopToken={hopToken}
          />
        </span>
        {character.badge !== undefined && (
          <span
            className={cn(
              'absolute top-0 right-0 flex -rotate-6 items-center justify-center gap-1.5 rounded-full bg-accent font-heading font-semibold text-accent-foreground shadow-soft',
              isActive ? 'animate-pop px-3 py-1.5 text-lg' : 'size-9',
            )}
          >
            <Star className="size-5 fill-current" aria-hidden="true" />
            <span className={cn(!isActive && 'sr-only')}>{character.badge}</span>
          </span>
        )}
      </span>
      <span className="sr-only">{character.name}</span>
    </button>
  );
}

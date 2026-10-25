'use client';

import { CarouselControls } from '@components/shared/carousel-controls';
import { CarouselSlide, type CarouselCharacter } from '@components/shared/carousel-slide';
import { NeighbourTap } from '@components/shared/neighbour-tap';
import { Check } from '@components/ui/icons';

import { useCalmMotion } from '@hooks/use-calm-motion';
import { useCarousel } from '@hooks/use-carousel';
import { useCarouselDrag } from '@hooks/use-carousel-drag';

import { cn } from '@lib/utils';

export type { CarouselCharacter };

export interface CharacterCarouselLabels {
  /** Names the whole carousel for a screen reader, e.g. "Your companions". */
  readonly group: string;
  readonly previous: string;
  readonly next: string;
  /** Said when the active one changes, e.g. "Max, 1 of 3, selected". */
  readonly selected: (name: string, position: number, total: number) => string;
}

export interface CharacterCarouselProps {
  readonly characters: readonly CarouselCharacter[];
  /** The id of the active (centred) character: the selection itself. */
  readonly activeId: string;
  readonly onActiveChange: (id: string) => void;
  readonly labels: CharacterCarouselLabels;
  readonly className?: string;
}

/**
 * A stage of characters of which the centred one is the choice. Change it by swiping or dragging
 * (pointer events), the arrow keys, Home / End, the two big buttons, or a tap on a neighbour. It is
 * one listbox (arrow keys move through it, `aria-activedescendant` names the active option), and a
 * polite status says "Max, 1 of 3, selected" when it changes. Calm mode and reduced motion leave out
 * the bob and the hop, and CSS makes the slide instant; nothing is lost, the tick and the size
 * still show the choice. The component knows no catalog: callers pass pictures and translated labels.
 */
export function CharacterCarousel({
  characters,
  activeId,
  onActiveChange,
  labels,
  className,
}: CharacterCarouselProps) {
  const nav = useCarousel({ ids: characters.map(({ id }) => id), activeId, onActiveChange });
  const drag = useCarouselDrag({ canStep: nav.canStep, onStep: nav.step });
  const isCalm = useCalmMotion();
  const active = characters[nav.activeIndex];

  return (
    <div
      className={cn(
        'flex w-full flex-col items-center gap-4 [--hero:min(40dvh,80vw,24rem)] [--step:calc(var(--hero)*0.62)]',
        className,
      )}
    >
      {/* Bleeds to the screen edges so a neighbour peeks out far enough to see and to tap. */}
      <div
        ref={drag}
        className="group relative h-(--hero) w-screen max-w-2xl cursor-grab touch-pan-y overflow-x-clip rounded-token-xl select-none active:cursor-grabbing"
      >
        <div
          role="listbox"
          tabIndex={0}
          aria-label={labels.group}
          aria-orientation="horizontal"
          aria-activedescendant={active === undefined ? undefined : nav.optionId(active.id)}
          onKeyDown={nav.onKeyDown}
          className="relative size-full rounded-token-xl"
        >
          {characters.map((character, index) => (
            <CarouselSlide
              key={character.id}
              character={character}
              id={nav.optionId(character.id)}
              offset={index - nav.activeIndex}
              hopToken={nav.hops}
              isCalm={isCalm}
              onSelect={() => {
                nav.goTo(index);
              }}
            />
          ))}
        </div>
        <NeighbourTap direction={-1} canStep={nav.canStep(-1)} onStep={nav.step} />
        <NeighbourTap direction={1} canStep={nav.canStep(1)} onStep={nav.step} />
      </div>
      <CarouselControls
        previousLabel={labels.previous}
        nextLabel={labels.next}
        canStepBack={nav.canStep(-1)}
        canStepForward={nav.canStep(1)}
        onStep={nav.step}
      >
        {active !== undefined && (
          <span
            key={active.id}
            aria-hidden="true"
            className="flex min-w-32 animate-pop items-center justify-center gap-2 rounded-full bg-primary px-6 py-2 font-heading text-4xl font-semibold text-primary-foreground shadow-soft"
          >
            <Check className="size-7" strokeWidth={3} aria-hidden="true" />
            {active.name}
          </span>
        )}
      </CarouselControls>
      <p role="status" className="sr-only">
        {active !== undefined &&
          labels.selected(active.name, nav.activeIndex + 1, characters.length)}
      </p>
    </div>
  );
}

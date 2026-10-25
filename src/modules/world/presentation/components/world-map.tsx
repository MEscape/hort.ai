'use client';

import type { ComponentType } from 'react';

import { Button } from '@components/ui/button';
import {
  BookOpen,
  Calculator,
  Landmark,
  Leaf,
  Lightbulb,
  Palette,
  Sparkles,
  Users,
} from '@components/ui/icons';
import type { IconProps } from '@components/ui/icons';

import { WORLD_EXTENT, WORLD_HOME, subjectRegion, worldPosition } from '../dto/world-layout-dto';
import { useWorldCamera } from '../hooks/use-world-camera';

import { IslandCard } from './island-card';
import styles from './world-map.module.css';

import type { Subject } from '../../application/contracts/world-constraints';
import type { IslandDto } from '../dto/island-dto';

export interface WorldMapLabels {
  readonly title: string;
  readonly hint: string;
  /** Names the row of subject buttons, e.g. "Where to?". */
  readonly jump: string;
  /** The button back to the starting islands. */
  readonly home: string;
  /** Read after an island where the child already did homework. */
  readonly homeworkHere: string;
  /** Read after an island that is still in the mist. */
  readonly inMist: string;
}

function statusOf(island: IslandDto, labels: WorldMapLabels): string | undefined {
  if (island.hadHomework) {
    return labels.homeworkHere;
  }
  return island.discovery === 'unrevealed' ? labels.inMist : undefined;
}

export interface WorldMapProps {
  readonly islands: readonly IslandDto[];
  readonly subjects: Readonly<Record<Subject, string>>;
  readonly labels: WorldMapLabels;
}

/** One picture per subject, on its button and its banner, so a child who reads slowly still finds it. */
const SUBJECT_ICONS: Readonly<Record<Subject, ComponentType<IconProps>>> = {
  deutsch: BookOpen,
  mathe: Calculator,
  'sachunterricht-natur': Leaf,
  'sachunterricht-gesellschaft': Landmark,
  'sprachen-kunst': Palette,
  zusammenleben: Users,
  lernen: Lightbulb,
};

/** A world coordinate as CSS, multiplied by the viewport's spread. */
const spread = (value: number) => `calc(${value}px * var(--world-spread))`;

/**
 * A stable spatial world: one archipelago per subject, each with its name floating above it. The
 * child drags to look around, or taps a subject and the camera glides there; nothing needs a precise
 * gesture, and every island is a real link named by its island.
 */
export function WorldMap({ islands, subjects, labels }: WorldMapProps) {
  const { viewportRef, planeRef, focusAt, glideTo, reset } = useWorldCamera();
  const groups = Object.entries(subjects) as Array<[Subject, string]>;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div
        role="group"
        aria-label={labels.jump}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        <Button variant="secondary" className="shrink-0" onClick={reset}>
          <Sparkles aria-hidden="true" />
          {labels.home}
        </Button>
        {groups.map(([subject, name]) => {
          const Icon = SUBJECT_ICONS[subject];
          return (
            <Button
              key={subject}
              variant="outline"
              className="shrink-0"
              onClick={() => {
                glideTo(subjectRegion(subject).center);
              }}
            >
              <Icon aria-hidden="true" />
              {name}
            </Button>
          );
        })}
      </div>
      <p id="world-pan-hint" className="text-sm text-copy-muted">
        {labels.hint}
      </p>
      <div className="relative min-h-80 flex-1 overflow-hidden rounded-token-xl bg-world shadow-soft">
        <div
          ref={viewportRef}
          role="region"
          aria-label={labels.title}
          aria-describedby="world-pan-hint"
          className={`${styles['viewport']} absolute inset-0 cursor-grab touch-none overflow-hidden overscroll-none select-none data-[dragging=true]:cursor-grabbing`}
        >
          <div
            ref={planeRef}
            data-world-plane=""
            className="absolute top-1/2 left-1/2 will-change-transform data-[gliding=true]:transition-transform data-[gliding=true]:duration-500 data-[gliding=true]:ease-soft"
            style={{
              width: spread(WORLD_EXTENT.width),
              height: spread(WORLD_EXTENT.height),
              transform: `translate3d(${spread(-WORLD_HOME.x)}, ${spread(-WORLD_HOME.y)}, 0)`,
            }}
          >
            {groups.map(([subject, name]) => {
              const Icon = SUBJECT_ICONS[subject];
              const { banner } = subjectRegion(subject);
              return (
                <section key={subject} aria-label={name} className="contents">
                  <p
                    aria-hidden="true"
                    className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-surface/85 px-4 py-1.5 font-heading text-lg font-semibold whitespace-nowrap text-copy shadow-soft sm:text-xl"
                    style={{ left: spread(banner.x), top: spread(banner.y) }}
                  >
                    <Icon className="size-5 text-primary-copy" />
                    {name}
                  </p>
                  <ul className="contents">
                    {islands
                      .filter((island) => island.subject === subject)
                      .map((island) => (
                        <li
                          key={island.areaId}
                          data-area-id={island.areaId}
                          className="absolute -translate-x-1/2 -translate-y-1/2"
                          style={{
                            left: spread(worldPosition(island.areaId).x),
                            top: spread(worldPosition(island.areaId).y),
                            width: 'var(--world-island)',
                          }}
                        >
                          <IslandCard
                            island={island}
                            status={statusOf(island, labels)}
                            onFocus={(event) => {
                              if (event.currentTarget.matches(':focus-visible')) {
                                focusAt(worldPosition(island.areaId));
                              }
                            }}
                          />
                        </li>
                      ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

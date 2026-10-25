'use client';

import { useTranslations } from '@i18n/client';

import { NUMBER_LINE_LIMITS } from '../../application/contracts/lesson-constraints';

import { NumberChoices } from './number-choices';

import type {
  NumberLineScene,
  SceneReaction,
} from '../../application/contracts/lesson-constraints';

/** The drawing, in its own units: the line, tick and label offsets, the hop and the jump's arc. */
const WIDTH = 600;
const TICK = 6;
const LABEL_GAP = 30;
const HOP_RISE = 28;
const HOP_LABEL_RISE = 30;
const JUMP_LABEL_RISE = 40;
const ARC_RISE = 70;
const MARGIN = 30;
const AXIS_Y = 90;
const PADDING_TICKS = 2;
const LABEL_EVERY_FROM = 12;
/** Text sizes in drawing units, so labels scale with the line and stay readable on a phone. */
const LABEL_SIZE = 24;
const HOP_SIZE = 20;

export interface NumberLineProps {
  readonly scene: NumberLineScene;
  readonly reaction: SceneReaction | null;
  readonly chosen: number | null;
  readonly attempt: number;
  readonly isSolved: boolean;
  readonly disabled: boolean;
  readonly onChoose: (value: number) => void;
}

/** The stretch of the line around the jump, two ticks of room on each side, inside 0 to 100. */
function windowOf({ start, jump }: NumberLineScene) {
  const landing = start + jump;
  const from = Math.max(0, Math.min(start, landing) - PADDING_TICKS);
  const to = Math.min(NUMBER_LINE_LIMITS.max, Math.max(start, landing) + PADDING_TICKS);
  return { from, to, landing };
}

/** One small hop per unit, numbered: the hint, "count along". */
function Hops({ start, jump, x }: { start: number; jump: number; x: (v: number) => number }) {
  const direction = Math.sign(jump);
  return Array.from({ length: Math.abs(jump) }, (_, index) => {
    const a = x(start + index * direction);
    const b = x(start + (index + 1) * direction);
    return (
      <g key={index} className="animate-pop">
        <path
          d={`M${a},${AXIS_Y} Q${(a + b) / 2},${AXIS_Y - HOP_RISE} ${b},${AXIS_Y}`}
          className="fill-none stroke-bloom stroke-2"
        />
        <text
          x={(a + b) / 2}
          y={AXIS_Y - HOP_LABEL_RISE}
          textAnchor="middle"
          fontSize={HOP_SIZE}
          className="fill-copy font-semibold"
        >
          {index + 1}
        </text>
      </g>
    );
  });
}

/**
 * A stretch of the number line: the start is marked, the jump is written above it ("+5"), and the
 * child picks where it lands. The hint draws every single step; a correct answer draws the jump.
 * The picture is static apart from small pops, so it reads the same with motion off.
 */
export function NumberLine({
  scene,
  reaction,
  chosen,
  attempt,
  isSolved,
  disabled,
  onChoose,
}: NumberLineProps) {
  const t = useTranslations('lesson');
  const { from, to, landing } = windowOf(scene);
  const x = (value: number) => MARGIN + ((value - from) / (to - from)) * (WIDTH - 2 * MARGIN);
  const labelEvery = to - from > LABEL_EVERY_FROM ? 2 : 1;
  const ticks = Array.from({ length: to - from + 1 }, (_, index) => from + index);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-5">
      <svg
        viewBox={`0 0 ${WIDTH} 130`}
        role="img"
        aria-label={t('sceneLabels.numberLine', { from, to, start: scene.start })}
        className="w-full rounded-token-lg bg-surface/70"
      >
        <line
          x1={MARGIN}
          x2={WIDTH - MARGIN}
          y1={AXIS_Y}
          y2={AXIS_Y}
          className="stroke-copy stroke-2"
        />
        {ticks.map((value) => (
          <g key={value}>
            <line
              x1={x(value)}
              x2={x(value)}
              y1={AXIS_Y - TICK}
              y2={AXIS_Y + TICK}
              className="stroke-copy"
            />
            {(value - from) % labelEvery === 0 || value === scene.start ? (
              <text
                x={x(value)}
                y={AXIS_Y + LABEL_GAP}
                textAnchor="middle"
                fontSize={LABEL_SIZE}
                className="fill-copy"
              >
                {value}
              </text>
            ) : null}
          </g>
        ))}
        <circle cx={x(scene.start)} cy={AXIS_Y} r={9} className="fill-accent" />
        <text
          x={x(scene.start)}
          y={AXIS_Y - JUMP_LABEL_RISE}
          textAnchor="middle"
          className="fill-copy font-heading text-2xl"
        >
          {scene.jump > 0 ? `+${scene.jump}` : `−${Math.abs(scene.jump)}`}
        </text>
        {reaction === 'count-steps' && !isSolved ? (
          <Hops start={scene.start} jump={scene.jump} x={x} />
        ) : null}
        {isSolved ? (
          <g className="animate-pop">
            <path
              d={`M${x(scene.start)},${AXIS_Y} Q${(x(scene.start) + x(landing)) / 2},${AXIS_Y - ARC_RISE} ${x(landing)},${AXIS_Y}`}
              className="fill-none stroke-success stroke-[3]"
            />
            <circle cx={x(landing)} cy={AXIS_Y} r={9} className="fill-success" />
          </g>
        ) : null}
      </svg>
      <NumberChoices
        label={t('sceneLabels.landing')}
        value={landing}
        chosen={chosen}
        reaction={reaction}
        attempt={attempt}
        disabled={disabled}
        onChoose={onChoose}
      />
    </div>
  );
}

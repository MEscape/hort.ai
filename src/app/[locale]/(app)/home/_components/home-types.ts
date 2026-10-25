import type { UiLine } from '@modules/voice/client';
import type { IslandDto } from '@modules/world/client';

import type { StripSession } from '@components/shared/status-strip';

/** Things the guide can stand next to. `stage` is its own home, so it does not walk for it. */
export type GuideTarget = 'stage' | 'strip' | 'task' | 'continue' | 'world' | 'teacher';

/**
 * Keys under `app.home.guide.*`: the greeting and the lines said when a card that stays on the page
 * is tapped. They are the fixed lines of the voice module (`UI_LINES`), so each can also be spoken.
 */
export type GuideLine = UiLine;

/** What the continue card shows of the last unfinished task. Never a solution or an answer. */
export interface UnfinishedTask {
  readonly title: string;
  readonly area: string;
  readonly lastStep: string;
  /** When the child last worked on it (ISO instant). */
  readonly updatedAt: string;
  readonly href: string;
}

/** One island of the small preview of the child's world. */
export type WorldPreviewIsland = IslandDto;

/** Everything the home screen is given by the page. Each of the optional sources is `null` until its backend exists. */
export interface HomeData {
  readonly childName: string;
  /** The parent allowed voice and confirmed its notice. */
  readonly hasVoice: boolean;
  readonly controls: {
    readonly dailyLimitMinutes: number | null;
    readonly allowedWindow: { readonly fromMinute: number; readonly untilMinute: number } | null;
  };
  /** The server's clock when the page was rendered (ISO instant). */
  readonly serverNow: string;
  /** Minutes learned today, or `null` while nothing measures them. */
  readonly usedMinutes: number | null;
  readonly session: StripSession | null;
  readonly unfinished: UnfinishedTask | null;
  /** New assignments from the teacher, or `null` while they cannot be loaded. */
  readonly teacherNewCount: number | null;
  readonly world: readonly WorldPreviewIsland[];
  /** Who says the lines aloud, and whether sound is allowed (voice on, a language the voices speak). */
  readonly speech: { readonly speakerId: string; readonly isAllowed: boolean };
}

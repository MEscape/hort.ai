import type { AppResult } from '@lib/result';

import { CHILD_LINES, LEVEL_UP_LINES, STARS_GAINED_LINES } from './child-lines';

import type {
  ChildCompanion,
  ChildHome,
  ChildTasks,
  FeedResult,
  LevelStatus,
} from '../../application/contracts/child-companion-model';

/**
 * One piece of a reply: a fixed line (spoken in the companion's voice), or a dynamic sentence (numbers,
 * teacher titles) that Alexa speaks itself.
 */
export type SpokenPart =
  | { readonly kind: 'line'; readonly text: string }
  | { readonly kind: 'alexa'; readonly text: string };

/** The only yes/no question of phase 1: the snack offer. */
export type OpenQuestion = 'feed';

/** Surface state from the previous reply (Alexa session attributes); learning state is never in it. */
export interface DialogSurface {
  readonly question: OpenQuestion | null;
  readonly last: readonly SpokenPart[];
}

export type ChildIntent =
  | 'launch'
  | 'feed'
  | 'level'
  | 'tasks'
  | 'soon'
  | 'yes'
  | 'no'
  | 'help'
  | 'repeat'
  | 'stop'
  | 'unknown';

export interface ChildReply {
  readonly parts: readonly SpokenPart[];
  readonly open: boolean;
  readonly question: OpenQuestion | null;
}

/** Most teacher titles read out at once (spec: at most three). */
const MAX_READ_TASKS = 3;
const MAX_TITLE_LENGTH = 120;
const ORDINALS = ['Erstens', 'Zweitens', 'Drittens'] as const;
/** The snack offer shows the companion's mood (web: `progression.feed.says.*`). */
const SNACK_BY_MOOD: Partial<Record<ChildHome['mood'], string>> = {
  bored: CHILD_LINES.snackHungry,
  sleepy: CHILD_LINES.snackSleepy,
};

const line = (text: string): SpokenPart => ({ kind: 'line', text });
const alexa = (text: string): SpokenPart => ({ kind: 'alexa', text });
const open = (parts: readonly SpokenPart[], question: OpenQuestion | null = null): ChildReply => ({
  parts,
  open: true,
  question,
});
const closed = (text: string): ChildReply => ({ parts: [line(text)], open: false, question: null });
const askWhatNow = (...parts: SpokenPart[]): ChildReply =>
  open([...parts, line(CHILD_LINES.whatNow)]);

/** Whether a turn needs the child's use cases; every other one is answered without the database. */
export function needsBackend(intent: ChildIntent, surface: DialogSurface): boolean {
  switch (intent) {
    case 'launch':
    case 'feed':
    case 'level':
    case 'tasks':
      return true;
    case 'yes':
      return surface.question === 'feed';
    default:
      return false;
  }
}

/** The calm answer when the use cases did not answer in time: as for a failure, never an error. */
export function timedOutReply(intent: ChildIntent): ChildReply {
  return intent === 'launch'
    ? closed(CHILD_LINES.unavailable)
    : askWhatNow(line(CHILD_LINES.notNow));
}

/**
 * The child dialog of phase 1: which backend operation an intent needs and how its outcome is said.
 * Every fact comes from the companion port on each turn; only the open question and the last reply
 * come from the surface. Failures become a calm sentence, never an error message.
 */
export async function childDialog(
  intent: ChildIntent,
  surface: DialogSurface,
  companion: ChildCompanion,
): Promise<ChildReply> {
  switch (intent) {
    case 'launch':
      return launchReply(await companion.home());
    case 'feed':
      return feedReply(await companion.feed());
    case 'level':
      return levelReply(await companion.level());
    case 'tasks':
      return tasksReply(await companion.tasks());
    case 'yes':
      return surface.question === 'feed'
        ? feedReply(await companion.feed())
        : askWhatNow(line(CHILD_LINES.options));
    case 'no':
      return surface.question === 'feed'
        ? askWhatNow(line(CHILD_LINES.laterThen))
        : closed(CHILD_LINES.bye);
    default:
      return surfaceReply(intent, surface);
  }
}

/** Replies that need no backend call: help, repeat, stop, phase-2 placeholders, not understood. */
function surfaceReply(intent: ChildIntent, surface: DialogSurface): ChildReply {
  switch (intent) {
    case 'stop':
      return closed(CHILD_LINES.bye);
    case 'help':
      return surface.question === 'feed'
        ? open([line(CHILD_LINES.helpFeed)], 'feed')
        : askWhatNow(line(CHILD_LINES.options));
    case 'repeat':
      return surface.last.length > 0
        ? open(surface.last, surface.question)
        : askWhatNow(line(CHILD_LINES.options));
    case 'soon':
      return askWhatNow(line(CHILD_LINES.soon));
    default:
      // Rule 7: the first miss asks again, the second names the options.
      return surface.last[0]?.text === CHILD_LINES.notUnderstood
        ? askWhatNow(line(CHILD_LINES.options))
        : open([line(CHILD_LINES.notUnderstood)], surface.question);
  }
}

function launchReply(home: AppResult<ChildHome>): ChildReply {
  if (home.isErr()) {
    return closed(CHILD_LINES.unavailable);
  }
  const { learningAllowed, openTasks, rewardAvailable, mood } = home.value;
  if (!learningAllowed) {
    return closed(CHILD_LINES.learningPause);
  }
  // At most three short sentences (spec rule 2): a short hello in the companion's voice instead of its
  // long catalog introduction, the teacher's tasks, then the snack offer or the question.
  const parts: SpokenPart[] = [line(CHILD_LINES.hello)];
  if (openTasks > 0) {
    parts.push(line(openTasks === 1 ? CHILD_LINES.teacherTask : CHILD_LINES.teacherTasks));
  }
  if (!rewardAvailable) {
    return askWhatNow(...parts);
  }
  const snack = SNACK_BY_MOOD[mood] ?? CHILD_LINES.snack;
  return open([...parts, line(snack)], 'feed');
}

function feedReply(result: AppResult<FeedResult>): ChildReply {
  if (result.isErr()) {
    return askWhatNow(line(CHILD_LINES.feedFailed));
  }
  const { outcome, stars, leveledUp, level } = result.value;
  if (outcome === 'already_claimed') {
    return askWhatNow(line(CHILD_LINES.full));
  }
  const parts = [line(CHILD_LINES.fed), fixedOr(STARS_GAINED_LINES[stars], starsGained(stars))];
  if (leveledUp) {
    parts.push(fixedOr(LEVEL_UP_LINES[level], `Level ${level}! Juhu!`));
  }
  return askWhatNow(...parts);
}

function levelReply(result: AppResult<LevelStatus>): ChildReply {
  if (result.isErr()) {
    return askWhatNow(line(CHILD_LINES.notNow));
  }
  const { level, starsToNext } = result.value;
  if (starsToNext === null) {
    return askWhatNow(line(CHILD_LINES.maxLevel));
  }
  const stars = starsToNext === 1 ? 'einen Stern' : `${starsToNext} Sterne`;
  return askWhatNow(alexa(`Du bist auf Level ${level}. Noch ${stars} bis Level ${level + 1}.`));
}

function tasksReply(result: AppResult<ChildTasks>): ChildReply {
  if (result.isErr()) {
    return askWhatNow(line(CHILD_LINES.notNow));
  }
  const { inClass, titles } = result.value;
  if (!inClass) {
    return askWhatNow(line(CHILD_LINES.noClass));
  }
  const spoken = titles.map(speakableTitle).filter((title) => title.length > 0);
  if (spoken.length === 0) {
    return askWhatNow(line(CHILD_LINES.noTasks));
  }
  return askWhatNow(
    line(CHILD_LINES.tasksIntro),
    alexa(readTitles(spoken.slice(0, MAX_READ_TASKS))),
    line(CHILD_LINES.soon),
  );
}

function readTitles(titles: readonly string[]): string {
  if (titles.length === 1) {
    return `${titles[0]}.`;
  }
  return titles.map((title, index) => `${ORDINALS[index]}, ${title}.`).join(' ');
}

/** A teacher title as one spoken phrase: no line breaks, no closing punctuation, bounded. */
function speakableTitle(title: string): string {
  return title
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?;:]+$/, '')
    .slice(0, MAX_TITLE_LENGTH);
}

function starsGained(stars: number): string {
  return stars === 1 ? 'Du hast einen Stern bekommen.' : `Du hast ${stars} Sterne bekommen.`;
}

/** The fixed line when there is one (companion voice), else the same sentence in Alexa's voice. */
function fixedOr(fixed: string | undefined, dynamic: string): SpokenPart {
  return fixed === undefined ? alexa(dynamic) : line(fixed);
}

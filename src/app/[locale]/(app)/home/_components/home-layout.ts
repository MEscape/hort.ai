/**
 * The frame of the home page, in one place so the loading skeleton and the finished page can never
 * drift apart: when the page arrives nothing moves.
 */
export const HOME_ROOT = 'relative isolate min-h-dvh overflow-x-clip bg-world';
export const HOME_MAIN =
  'relative mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-2 pb-safe md:gap-6 md:px-8 md:pt-4';
export const HOME_GRID = 'grid min-w-0 gap-4 md:grid-cols-2 md:items-center md:gap-8';
export const HOME_STAGE = 'min-w-0 md:self-start';
export const HOME_CARDS = 'flex min-w-0 flex-col gap-4';
/** Smaller on a phone so the cards stay within a thumb's reach; full size beside the cards. */
export const HOME_STAGE_SIZE = 'size-28 md:size-64 lg:size-72';

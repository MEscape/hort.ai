import { APP_IDENTITY } from '@lib/config';
import { cn } from '@lib/utils';

/** The owl repeats the screen’s message; its expression never carries information alone. */
export type LumiMood = 'hello' | 'think' | 'happy' | 'oops' | 'mail';

export interface LumiProps {
  readonly mood?: LumiMood;
  readonly label?: string;
  readonly isAmbient?: boolean;
  readonly className?: string;
}

/** All moods share the SVG artwork used for app icons and email branding. */
export function Lumi({ mood = 'hello', label, isAmbient = false, className }: LumiProps) {
  return (
    <svg
      viewBox="0 0 160 180"
      role={label === undefined ? undefined : 'img'}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
      focusable="false"
      data-mood={mood}
      className={cn('size-28 overflow-visible', isAmbient && 'animate-float', className)}
    >
      <use href={`${APP_IDENTITY.assets.owl}#body`} />
      <use href={`${APP_IDENTITY.assets.owl}#face-${mood}`} />
      <use href={`${APP_IDENTITY.assets.owl}#${mood === 'mail' ? 'letter' : 'book'}`} />
      <use href={`${APP_IDENTITY.assets.owl}#wings`} />
    </svg>
  );
}

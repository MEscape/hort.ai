'use client';

import { useTranslations } from '@i18n/client';

import { openingTime } from './learning-pause';

import type { LearningPause } from './learning-pause';

/**
 * The companion's calm line when the parent's learning window is closed or the day's limit is
 * reached (#88). A friendly sentence with the time it is back; never a timer, never a reproach.
 */
export function LearningPauseNote({ pause }: { readonly pause: LearningPause }) {
  const t = useTranslations('guidance');
  const time = openingTime(pause);
  const text =
    pause.reason === 'window'
      ? t(pause.anyTime ? 'pause.window.anyTime' : 'pause.window.at', { day: pause.day, time })
      : t(pause.anyTime ? 'pause.limit.anyTime' : 'pause.limit.at', { time });
  return (
    <p role="alert" className="font-semibold text-copy">
      {text}
    </p>
  );
}

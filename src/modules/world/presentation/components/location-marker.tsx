// @ui-plain button a pin placed over the artwork at the place's position, not an action button
import { MapPin } from '@components/ui/icons';

import { cn } from '@lib/utils';

import type { IslandLocationDto } from '../dto/island-dto';

/**
 * A place's `y` is where it stands on the ground; the pin floats this much (a fraction of the
 * picture's height) above it, so it points at the place without hiding it.
 */
const PIN_LIFT = 0.08;

export interface LocationMarkerProps {
  readonly location: IslandLocationDto;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
}

/**
 * A place on the island: its name over a pin whose tip stands on the place. A real button with a
 * hit area of at least 44 px, however small the drawn place is.
 */
export function LocationMarker({ location, isSelected, onSelect }: LocationMarkerProps) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onSelect}
      // The position is data (a fraction of the picture), so it cannot be a class.
      style={{ left: `${location.x * 100}%`, top: `${(location.y - PIN_LIFT) * 100}%` }}
      className="group absolute flex min-h-11 min-w-11 -translate-x-1/2 -translate-y-full flex-col items-center rounded-token-sm"
    >
      <span
        className={cn(
          'max-w-28 rounded-full px-2 py-0.5 text-center text-xs leading-tight font-semibold shadow-soft transition-colors sm:text-sm',
          // On a phone the names would overlap: only the chosen one shows, the rest are read out.
          isSelected
            ? 'bg-primary text-primary-foreground'
            : 'sr-only bg-surface text-copy sm:not-sr-only',
        )}
      >
        {location.name}
      </span>
      <MapPin
        aria-hidden="true"
        className={cn(
          'size-7 drop-shadow-sm transition-transform group-hover:-translate-y-0.5',
          isSelected ? 'fill-accent text-primary' : 'fill-surface text-primary-copy',
        )}
      />
    </button>
  );
}

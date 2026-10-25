import Image from 'next/image';

import { APP_IDENTITY } from '@lib/config';
import { cn } from '@lib/utils';

export interface HortaiLogoProps {
  readonly className?: string;
}

/** The supplied identity, adapted as resolution-independent vector artwork. */
export function HortaiLogo({ className }: HortaiLogoProps) {
  return (
    <Image
      src={APP_IDENTITY.assets.logo}
      alt={APP_IDENTITY.name}
      width={496}
      height={160}
      // Every page shows the logo at the very top, so it is above the fold (often the LCP element).
      loading="eager"
      className={cn('h-14 w-auto', className)}
    />
  );
}

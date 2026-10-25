import type { ReactNode } from 'react';

import type { IconProps } from '@components/ui/icons';

import { cn } from '@lib/utils';

/** The look every pressable card of the home screen shares: big, calm, one idea, a firm bottom edge. */
export const HOME_CARD_CLASSES =
  'h-auto min-h-28 w-full justify-start gap-4 rounded-token-xl border-2 border-b-8 border-copy/20 px-5 py-4 text-left whitespace-normal shadow-soft transition-[transform,box-shadow] active:translate-y-1 motion-reduce:transform-none data-[guided=true]:ring-4 data-[guided=true]:ring-accent';

interface HomeCardBodyProps {
  readonly icon: (props: IconProps) => ReactNode;
  readonly title: string;
  readonly detail?: ReactNode;
  readonly className?: string;
}

/** An icon in a round tint, a short title and one line of detail: the inside of a card. */
export function HomeCardBody({ icon: Icon, title, detail, className }: HomeCardBodyProps) {
  return (
    <>
      <span
        aria-hidden="true"
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-highlight text-primary-copy"
      >
        <Icon className="size-8" />
      </span>
      <span className={cn('flex min-w-0 flex-col gap-1', className)}>
        <span className="font-heading text-2xl leading-tight font-semibold text-copy">{title}</span>
        {detail !== undefined && <span className="text-base text-copy-muted">{detail}</span>}
      </span>
    </>
  );
}

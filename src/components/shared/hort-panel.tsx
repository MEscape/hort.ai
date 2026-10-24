'use client';

import type { ReactNode } from 'react';

import { Hort } from '@components/brand/hort';
import type { HortMood } from '@components/brand/hort';
import { Card, CardContent, CardFooter, CardHeader } from '@components/ui/card';

import { useFocusOnMount } from '@hooks/use-focus-on-mount';

export interface HortPanelProps {
  /** How Hort looks while this screen is in front of the person. */
  readonly mood?: HortMood;
  /** The page's one heading. */
  readonly title: string;
  readonly description?: string;
  /** Take focus when the panel appears: for an answer that replaced a form. */
  readonly shouldTakeFocus?: boolean;
  /** Beneath the content, on the tinted strip: the way out ("Back to sign in"). */
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}

/**
 * The frame of every Hort screen that is a single card (sign-in, onboarding): Hort sitting on the top edge of a white "storybook page",
 * the heading, a short sentence in reading size, the content, and a quiet footer for the way
 * out. It holds the page's `h1`.
 */
export function HortPanel({
  mood = 'hello',
  title,
  description,
  shouldTakeFocus = false,
  footer,
  children,
}: HortPanelProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>(shouldTakeFocus);

  return (
    <Card>
      <CardHeader className="pt-0">
        <Hort mood={mood} isAmbient className="-mt-16 size-28" />
        <h1 ref={headingRef} tabIndex={-1} className="text-3xl sm:text-4xl">
          {title}
        </h1>
        {description !== undefined && (
          <p className="measure text-lead wrap-anywhere text-copy-muted">{description}</p>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer !== undefined && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}

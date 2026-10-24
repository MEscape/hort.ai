import { notFound } from 'next/navigation';

/**
 * Turns every unmatched URL below a locale into a 404 that is rendered inside
 * the locale layout (translated, themed). Without it the framework's bare
 * not-found page would answer instead.
 *
 * With `cacheComponents` a dynamic segment must be known at build time or sit
 * behind Suspense. There is nothing to render here, so one sample value lets
 * the route be prerendered.
 */
/**
 * Nothing here renders: the route exists to answer 404 inside the locale layout,
 * so there is no shell to prefetch or validate.
 */
export const instant = false;

export function generateStaticParams() {
  return [{ rest: ['not-found'] }];
}

export default function UnmatchedRoutePage(): never {
  notFound();
}

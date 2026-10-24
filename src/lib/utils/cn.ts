/**
 * Class-name composition with Tailwind conflict resolution: `cn('p-2', cond && 'p-4')` keeps the
 * last conflicting utility. In its own file because it is the one utility here that depends on a
 * third-party package, so the rest stay dependency-free.
 */
export { cn } from 'cn';

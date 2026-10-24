import { cn } from '@lib/utils';

export interface WorldSceneProps {
  readonly className?: string;
}

/** Paper-colored hills echo hortai.png and stay quiet around the form. */
export function WorldScene({ className }: WorldSceneProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden bg-world', className)}
    >
      <svg
        viewBox="0 0 1440 420"
        preserveAspectRatio="none"
        focusable="false"
        className="absolute inset-x-0 bottom-0 h-1/3 min-h-40 w-full"
      >
        <path
          d="M0 80C190 102 245 244 469 208S725 78 949 149S1224 295 1440 207V420H0Z"
          className="fill-landscape-far"
        />
        <path
          d="M0 215C195 148 337 332 579 286S816 198 1030 258S1242 328 1440 267V420H0Z"
          className="fill-landscape-near"
        />
        <path
          d="M0 340C245 271 342 399 631 355S1142 328 1440 355V420H0Z"
          className="fill-landscape-front"
        />
      </svg>
    </div>
  );
}

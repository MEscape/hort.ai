import { cn } from '@lib/utils';

const ARTWORK = {
  task: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="120" cy="178" rx="84" ry="9" className="fill-copy/20" />
      <g transform="rotate(-7 112 103)">
        <rect
          x="49"
          y="23"
          width="127"
          height="145"
          rx="14"
          className="fill-highlight stroke-highlight-border"
          strokeWidth="3"
        />
        <rect x="61" y="23" width="115" height="137" rx="10" className="fill-surface" />
        <path
          d="M66 47H49m17 26H49m17 26H49m17 26H49m17 26H49"
          className="stroke-secondary"
          strokeWidth="7"
        />
        <path
          d="M88 58h56M88 80h46M88 102h55M88 124h30"
          className="stroke-highlight-border"
          strokeWidth="6"
        />
        <path
          d="m136 135 5 6 13-15"
          className="stroke-secondary-copy"
          strokeWidth="5"
          fill="none"
        />
      </g>
      <g transform="rotate(32 173 103)">
        <rect
          x="160"
          y="38"
          width="25"
          height="111"
          rx="5"
          className="fill-accent stroke-accent-copy"
          strokeWidth="3"
        />
        <path d="M160 137h25l-12 29Z" className="fill-surface stroke-accent-copy" strokeWidth="3" />
        <path d="m169 158 4 8 4-8" className="fill-primary" />
        <path d="M161 51h23M173 64v64" className="stroke-accent-copy" strokeWidth="3" />
        <rect x="160" y="29" width="25" height="22" rx="6" className="fill-bloom" />
      </g>
    </g>
  ),
  school: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="119" cy="179" rx="74" ry="10" className="fill-sunken" />
      <path
        d="M91 47V35c0-22 56-22 56 0v12"
        className="stroke-secondary-copy"
        strokeWidth="8"
        fill="none"
      />
      <rect
        x="55"
        y="65"
        width="129"
        height="110"
        rx="33"
        className="fill-secondary stroke-secondary-copy"
        strokeWidth="4"
      />
      <path d="M70 73V47l37-8 7 36" className="fill-bloom stroke-bloom-copy" strokeWidth="3" />
      <path d="m116 73 6-35 42 8-4 31" className="fill-accent stroke-accent-copy" strokeWidth="3" />
      <path
        d="M55 76c0-25 23-31 65-31s64 7 64 31v22c-25 16-99 16-129 0Z"
        className="fill-secondary stroke-secondary-copy"
        strokeWidth="4"
      />
      <rect
        x="77"
        y="121"
        width="86"
        height="43"
        rx="13"
        className="fill-highlight stroke-secondary-copy"
        strokeWidth="3"
      />
      <path d="M87 132h66" className="stroke-secondary-copy" strokeWidth="3" />
      <rect
        x="108"
        y="91"
        width="24"
        height="30"
        rx="8"
        className="fill-accent stroke-accent-copy"
        strokeWidth="3"
      />
      <path d="M120 101v9" className="stroke-accent-copy" strokeWidth="4" />
    </g>
  ),
  continue: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="120" cy="176" rx="90" ry="10" className="fill-sunken" />
      <path
        d="M28 56c35-11 63-7 92 9 27-16 57-20 91-9v112c-34-8-64-4-91 10-29-14-57-18-92-10Z"
        className="fill-primary stroke-primary-copy"
        strokeWidth="4"
      />
      <path
        d="M34 43c35-7 60-2 86 16 29-17 54-22 85-16v111c-32-4-58 1-85 16-26-15-52-20-86-16Z"
        className="fill-surface stroke-highlight-border"
        strokeWidth="3"
      />
      <path
        d="M120 61v106M50 70c21-2 38 2 53 10M50 90c21-2 38 2 53 10M50 111c19-2 36 2 48 8M137 111c18-8 33-10 51-8M137 132c18-8 33-10 51-8"
        className="stroke-highlight-border"
        strokeWidth="4"
        fill="none"
      />
      <path
        d="m149 39 30-3v65l-15-12-15 15Z"
        className="fill-bloom stroke-bloom-copy"
        strokeWidth="3"
      />
      <path d="m79 37 5-13M190 24l8 9" className="stroke-accent-copy" strokeWidth="4" />
    </g>
  ),
} as const;

interface StartIllustrationProps {
  readonly kind: keyof typeof ARTWORK;
  readonly className?: string;
}

/** Original homework objects; the companion comes from the shared Hort component. */
export function StartIllustration({ kind, className }: StartIllustrationProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 240 200"
      className={cn('overflow-visible', className)}
    >
      {ARTWORK[kind]}
    </svg>
  );
}

import { cn } from '@lib/utils';

const ARTWORK = {
  companion: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="124" cy="181" rx="71" ry="10" className="fill-sunken" />
      <path
        d="M77 118c-29 7-39-11-32-24 5-8 12 1 16 5M170 109c24-9 21-29 31-30 13-1 17 31-17 48"
        className="fill-secondary stroke-secondary-copy"
        strokeWidth="4"
      />
      <path
        d="M70 112c-2-48 14-74 51-74 39 0 61 29 61 77 0 41-21 61-57 61-38 0-54-21-55-64Z"
        className="fill-secondary stroke-secondary-copy"
        strokeWidth="3"
      />
      <path
        d="M118 39C99 37 94 21 97 14c19-1 30 11 27 25M125 38c-1-19 13-30 28-28 2 16-7 28-28 28"
        className="fill-accent stroke-accent-copy"
        strokeWidth="3"
      />
      <ellipse cx="98" cy="88" rx="20" ry="24" className="fill-surface" />
      <ellipse cx="145" cy="88" rx="20" ry="24" className="fill-surface" />
      <ellipse cx="103" cy="92" rx="7" ry="10" className="fill-secondary-foreground" />
      <ellipse cx="140" cy="92" rx="7" ry="10" className="fill-secondary-foreground" />
      <circle cx="105" cy="88" r="2" className="fill-surface" />
      <circle cx="142" cy="88" r="2" className="fill-surface" />
      <ellipse cx="83" cy="116" rx="11" ry="6" className="fill-bloom" />
      <ellipse cx="160" cy="116" rx="11" ry="6" className="fill-bloom" />
      <path
        d="M110 117q12 15 24-1"
        className="stroke-secondary-foreground"
        strokeWidth="4"
        fill="none"
      />
      <path
        d="M90 170c-13 2-16 10-5 12h21M144 173c8 11 28 10 28 2"
        className="fill-secondary stroke-secondary-copy"
        strokeWidth="4"
      />
    </g>
  ),
  task: (
    <g strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="120" cy="178" rx="84" ry="9" className="fill-focus" />
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

/** Provisional original artwork: decorative, token-colored, and replaceable independently of UI. */
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

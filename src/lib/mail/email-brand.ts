import { APP_IDENTITY } from '@lib/config';

/**
 * What a message looks like, resolved to LITERAL values: mail clients read neither CSS custom
 * properties nor `color-mix()`. The renderer takes everything it draws from here and holds no
 * colour, length or font of its own.
 */
export interface EmailBrand {
  readonly color: {
    /** The button's fill and the card's top edge. */
    readonly primary: string;
    /** Text on the button. */
    readonly primaryForeground: string;
    /** The brand colour as link text on the card. */
    readonly primaryCopy: string;
    /** The page behind the card, the card, its text, muted text and rules. */
    readonly canvas: string;
    readonly surface: string;
    readonly text: string;
    readonly textMuted: string;
    readonly border: string;
  };
  /** A CSS length for the card, the facts box and the button. */
  readonly radius: string;
  /** A CSS length: the space inside the card. */
  readonly padding: string;
  /** Font stacks that end in a system font, because a webfont never loads in a mail client. */
  readonly font: {
    readonly heading: string;
    readonly body: string;
    /** For a reference a person may read out or copy. */
    readonly mono: string;
  };
}

const SYSTEM_SANS = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO_STACK = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

/** The look of every message. Colours come from `APP_IDENTITY`, which a test pins to `globals.css`. */
export const EMAIL_BRAND: EmailBrand = {
  color: {
    primary: APP_IDENTITY.colors.primary,
    primaryForeground: APP_IDENTITY.colors.primaryForeground,
    primaryCopy: APP_IDENTITY.colors.primaryCopy,
    canvas: APP_IDENTITY.colors.background,
    surface: APP_IDENTITY.colors.surface,
    text: APP_IDENTITY.colors.text,
    textMuted: APP_IDENTITY.colors.textMuted,
    border: APP_IDENTITY.colors.border,
  },
  // `--hortai-radius`.
  radius: '14px',
  padding: '32px',
  font: {
    heading: `Fredoka, 'Arial Rounded MT Bold', ui-rounded, ${SYSTEM_SANS}`,
    body: `Nunito, ui-rounded, ${SYSTEM_SANS}`,
    mono: MONO_STACK,
  },
};

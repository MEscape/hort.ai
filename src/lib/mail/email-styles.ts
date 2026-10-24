import type { EmailBrand } from './email-brand';

/**
 * Every style of a message, in one place. Mail clients drop `<style>` blocks and classes, so each
 * element carries its CSS inline; written here as objects and joined, instead of as long strings
 * inside the markup. Colours, radius, padding and fonts come from the brand and nowhere else: the
 * numbers below are only layout (a column's width, the gap between two blocks).
 */

type Declarations = Readonly<Record<string, string>>;

/** `{ 'margin': '0', color: 'red' }` as `margin: 0; color: red`. Names are code; values are brand tokens or constants. */
function css(declarations: Declarations): string {
  return Object.entries(declarations)
    .map(([property, value]) => `${property}: ${value}`)
    .join('; ');
}

/** Hidden text that mail clients show beside the subject: the first line of the message, not "View in browser". */
const PREHEADER = css({
  display: 'none',
  'max-height': '0',
  overflow: 'hidden',
  opacity: '0',
  'mso-hide': 'all',
  'font-size': '1px',
  'line-height': '1px',
  color: 'transparent',
});

export const LOGO_WIDTH = 120;
export const LOGO_HEIGHT = 81;

/** The inline style of each element of a message, for one brand. */
export function emailStyles(brand: EmailBrand) {
  const { color, font, radius, padding } = brand;
  const rule = `1px solid ${color.border}`;

  /** A cell of the facts table; the first row has no rule above it. */
  const factCell = (position: 'label' | 'value', isFirstRow: boolean, isCode: boolean) => {
    const isLabel = position === 'label';
    return css({
      padding: '12px 16px',
      'font-size': '14px',
      'line-height': '1.5',
      'vertical-align': 'top',
      'text-align': 'left',
      'font-weight': !isLabel && isCode ? '600' : '400',
      color: isLabel ? color.textMuted : color.text,
      ...(isFirstRow ? {} : { 'border-top': rule }),
      ...(!isLabel && isCode ? { 'font-family': font.mono, 'letter-spacing': '0.04em' } : {}),
      ...(isLabel ? { width: '32%' } : {}),
    });
  };

  return {
    preheader: PREHEADER,
    page: css({
      margin: '0',
      padding: '0',
      'background-color': color.canvas,
      'font-family': font.body,
      color: color.text,
    }),
    outer: css({ padding: '40px 16px' }),
    column: css({ 'max-width': '560px', margin: '0 auto' }),
    logo: css({ display: 'block', margin: '0 auto 24px', border: '0', height: 'auto' }),
    /** A flat card with the brand colour as its top edge: a message without a button still looks like its sender. */
    card: css({
      padding,
      'background-color': color.surface,
      border: rule,
      'border-top': `4px solid ${color.primary}`,
      'border-radius': radius,
      'font-size': '15px',
      'line-height': '1.6',
      color: color.text,
    }),
    heading: css({
      margin: '0 0 16px 0',
      'font-family': font.heading,
      'font-size': '24px',
      'font-weight': '600',
      'line-height': '1.3',
      color: color.text,
    }),
    greeting: css({ margin: '0 0 8px 0' }),
    paragraph: css({ margin: '0 0 24px 0' }),
    facts: css({
      width: '100%',
      margin: '0 0 24px 0',
      'background-color': color.canvas,
      border: rule,
      'border-radius': radius,
      'border-collapse': 'separate',
      'border-spacing': '0',
    }),
    factCell,
    actionRow: css({ margin: '8px 0 0 0' }),
    button: css({
      display: 'inline-block',
      padding: '13px 28px',
      'background-color': color.primary,
      color: color.primaryForeground,
      'border-radius': radius,
      'font-family': font.body,
      'font-size': '15px',
      'font-weight': '600',
      'line-height': '1.2',
      'text-decoration': 'none',
    }),
    note: css({ margin: '12px 0 0 0', 'font-size': '13px', color: color.textMuted }),
    fallback: css({
      margin: '24px 0 0 0',
      'font-size': '13px',
      'line-height': '1.5',
      color: color.textMuted,
    }),
    fallbackLink: css({ color: color.primaryCopy, 'word-break': 'break-all' }),
    outro: css({
      margin: '32px 0 0 0',
      'padding-top': '24px',
      'border-top': rule,
      'font-size': '14px',
      color: color.textMuted,
    }),
    credit: css({
      margin: '0',
      padding: '20px 0 0 0',
      'text-align': 'center',
      'font-size': '12px',
      color: color.textMuted,
    }),
  };
}

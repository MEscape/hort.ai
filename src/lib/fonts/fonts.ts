import localFont from 'next/font/local';

/**
 * Loaded exactly once here, from `public/fonts` (see its README), and exposed as CSS variables
 * consumed by the design tokens in globals.css (`--hortai-font-heading`, `--hortai-font-body`
 * and the `data-font="readable"` variant). styling.md: "prefer shared design tokens over
 * hard-coded visual values" — this file is what makes the typeface itself a token rather than
 * a per-component font import.
 */

export const fontFredoka = localFont({
  src: [
    {
      path: '../../../public/fonts/fredoka/Fredoka-Variable.woff2',
      weight: '300 700',
      style: 'normal',
    },
  ],
  variable: '--font-fredoka',
  display: 'swap',
});

export const fontNunito = localFont({
  src: [
    {
      path: '../../../public/fonts/nunito/Nunito-Variable.woff2',
      weight: '200 1000',
      style: 'normal',
    },
  ],
  variable: '--font-nunito',
  display: 'swap',
});

export const fontAtkinson = localFont({
  src: [
    {
      path: '../../../public/fonts/atkinson-hyperlegible/AtkinsonHyperlegible-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../../public/fonts/atkinson-hyperlegible/AtkinsonHyperlegible-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-atkinson',
  display: 'swap',
});

/** Applied on `<html>` in the root layout so every route inherits all variables. */
export const fontVariables = `${fontFredoka.variable} ${fontNunito.variable} ${fontAtkinson.variable}`;

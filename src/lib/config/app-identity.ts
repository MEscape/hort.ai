/**
 * The product's own identity: its name and its colours, for the places that cannot read CSS
 * custom properties: `theme-color`, the web app manifest and every e-mail (mail clients resolve
 * neither `var()` nor `color-mix()`).
 *
 * `colors` are LITERAL copies of the `--hortai-color-*` tokens in `globals.css`; a test pins them.
 *
 * The name is a brand, so it is not translated.
 */
export const APP_IDENTITY = {
  name: 'HortAi',
  colors: {
    primary: '#4a33b5',
    primaryForeground: '#ffffff',
    primaryCopy: '#4a33b5',
    background: '#f4f2fc',
    surface: '#ffffff',
    text: '#1f1a3d',
    textMuted: '#55507a',
    border: '#ddd8f0',
  },
} as const;

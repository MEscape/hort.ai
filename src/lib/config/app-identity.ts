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
  name: 'Hort.ai',
  assets: {
    owl: '/brand/owl.svg',
    logo: '/brand/logo.svg',
    emailLogo: '/email/hortai.png',
    socialImage: '/brand/social.png',
  },
  colors: {
    primary: '#7b421f',
    primaryForeground: '#ffffff',
    primaryCopy: '#7b421f',
    background: '#fff8f0',
    surface: '#fffdf9',
    text: '#38271d',
    textMuted: '#69513f',
    border: '#ebd9c5',
  },
} as const;

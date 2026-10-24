import designTokens from '../plugins/design-tokens.mjs';

import { TEST_FILES } from './globs.mjs';

/**
 * Design-token conformance. Enforces color, size and token usage across UI components.
 */
export const tokens = [
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/app/globals.css', 'src/data/**', ...TEST_FILES],
    plugins: { 'design-tokens': designTokens },
    rules: {
      'design-tokens/no-raw-palette-color': 'error',
      'design-tokens/no-literal-white-black': 'error',
      'design-tokens/no-arbitrary-token': 'error',
      'design-tokens/no-raw-hex': 'error',
      'design-tokens/no-raw-color-fn': 'error',
      'design-tokens/no-arbitrary-size': 'error',
      'design-tokens/no-screen-height': 'error',
    },
  },
];

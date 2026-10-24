import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { APP_IDENTITY } from '@lib/config';

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

/** The literal `#rrggbb` the first declaration of `--hortai-color-<name>` holds. */
function tokenValue(name: string): string | undefined {
  const [, rest] = css.split(`--hortai-color-${name}:`);
  return rest?.trim().slice(0, '#rrggbb'.length).toLowerCase();
}

describe('APP_IDENTITY', () => {
  it('copies the design tokens of globals.css literally', () => {
    expect(APP_IDENTITY.colors).toEqual({
      primary: tokenValue('primary'),
      primaryForeground: tokenValue('primary-foreground'),
      primaryCopy: tokenValue('primary-copy'),
      background: tokenValue('background'),
      surface: tokenValue('surface'),
      text: tokenValue('text'),
      textMuted: tokenValue('text-muted'),
      border: tokenValue('border'),
    });
  });
});

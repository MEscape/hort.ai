import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC_DIR = join(process.cwd(), 'src');

function components(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return components(path);
    }
    return entry.name.endsWith('.tsx') ? [path] : [];
  });
}

const PASSWORD_FIELD = /<(PasswordField|NewPasswordFields)\b|type="password"/;

/**
 * A form submitted before React has hydrated falls back to the browser's default, a GET, which
 * writes every field into the address: the password would land in the history and in server logs.
 * `method="post"` keeps it in the request body, whatever happens before hydration.
 */
describe('forms that take a password', () => {
  const forms = components(SRC_DIR).filter((file) => {
    const source = readFileSync(file, 'utf8');
    return source.includes('<form') && PASSWORD_FIELD.test(source);
  });

  it('exist', () => {
    expect(forms.length).toBeGreaterThan(0);
  });

  it.each(forms.map((file) => [relative(process.cwd(), file), file]))(
    '%s never sends the password in the address',
    (_, file) => {
      expect(readFileSync(file, 'utf8')).toMatch(/<form\b[^>]*\bmethod="post"/);
    },
  );
});

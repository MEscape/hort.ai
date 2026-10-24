import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  AUTHORIZATION,
  SHARED_LIB_ALLOW,
  SHARED_PORT_LIBS,
  UNSAVED_WORK_GUARD,
} from '../../eslint/policy/policy.mjs';

const ROOT = process.cwd();

/** Every file below `dir` (absolute paths); none when the folder does not exist yet. */
function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  return (readdirSync(dir, { recursive: true }) as string[]).map((entry) => join(dir, entry));
}

const authServiceFiles = filesUnder(join(ROOT, 'src/modules')).filter((file) =>
  file.endsWith('authorization-service.ts'),
);

const hookNames = [
  ...filesUnder(join(ROOT, 'src/hooks')),
  ...filesUnder(join(ROOT, 'src/components')),
]
  .filter((file) => /\.(?:ts|tsx)$/.test(file))
  .flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/\b(use[A-Za-z0-9]+)\b/g)])
  .flatMap((match) => (match[1] === undefined ? [] : [match[1]]))
  .filter((name) => UNSAVED_WORK_GUARD.test(name));

// Credentials and single-field forms may explicitly opt out under react.md. A shared hook's
// directory existing does not imply that an editor or an unsaved-work guard is needed yet.
const formsRequiringGuard = filesUnder(join(ROOT, 'src/modules'))
  .filter((file) => /[\\/]presentation[\\/](?:components|hooks)[\\/].*\.tsx?$/.test(file))
  .map((file) => readFileSync(file, 'utf8'))
  .filter((source) => /\buseForm\s*(?:<|\()/.test(source))
  .filter((source) => !/@unsaved-work\s+none\s+\S/.test(source));

describe('policy consistency', () => {
  // The authorization service belongs to the first module that has one; until then there is nothing to compare.
  it.skipIf(authServiceFiles.length === 0)(
    'declares AUTHORIZATION method names that match the authorization service',
    () => {
      const content = authServiceFiles.map((file) => readFileSync(file, 'utf8')).join('\n');

      expect(content).toContain(AUTHORIZATION.actorCall);
      expect(content).toContain(AUTHORIZATION.resourceCall);
    },
  );

  it('ensures an unsaved-work guard exists when a form requires one', () => {
    if (formsRequiringGuard.length > 0) {
      expect(hookNames.length).toBeGreaterThan(0);
    }
  });

  it('ensures all shared libs in SHARED_LIB_ALLOW and SHARED_PORT_LIBS exist in src/lib', () => {
    const libDir = join(ROOT, 'src/lib');
    const existingLibs = new Set(
      readdirSync(libDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name),
    );

    for (const portLib of SHARED_PORT_LIBS) {
      expect(
        existingLibs.has(portLib),
        `SHARED_PORT_LIBS '${portLib}' must exist under src/lib/${portLib}`,
      ).toBe(true);
    }

    for (const [layer, libs] of Object.entries(SHARED_LIB_ALLOW)) {
      if (!Array.isArray(libs)) {
        continue;
      }
      for (const lib of libs as string[]) {
        expect(
          existingLibs.has(lib),
          `SHARED_LIB_ALLOW.${layer} '${lib}' must exist under src/lib/${lib}`,
        ).toBe(true);
      }
    }
  });
});

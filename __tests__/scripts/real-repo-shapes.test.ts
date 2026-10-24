import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { insertEnvEntry } from '../../scripts/commands/env';
import { runModule } from '../../scripts/commands/module';
import { addMessage } from '../../scripts/commands/translation';
import { runUseCase } from '../../scripts/commands/usecase';
import { PATHS } from '../../scripts/lib/config';
import { parseFields } from '../../scripts/lib/fields';
import { formatSource } from '../../scripts/lib/format';
import { buildSpec } from '../../scripts/lib/spec';
import { registerLocale } from '../../scripts/templates/wiring';

import { REAL_ROOT } from './helpers';

vi.setConfig({ testTimeout: 60_000 });

/**
 * The other generator tests are hermetic (frozen fixtures). These check, WITHOUT writing, that the
 * files of the real repository still have the shape the generators rely on. When one fails, the
 * repository changed shape: update the generator (and refresh tests/scripts/fixtures).
 *
 * Probe names are deliberately unlikely to exist, so the checks do not depend on what anyone has
 * generated for real.
 */
const real = (path: string): string => readFileSync(join(REAL_ROOT, path), 'utf8');

describe('the real repository still has the shape the generators expect', () => {
  it('lets a new namespace be registered in both locale registries', () => {
    const spec = buildSpec({
      module: 'zz-probe',
      fields: parseFields(['name:string']),
      unique: [],
      withClient: false,
      withTests: false,
    });

    for (const locale of ['en', 'de'] as const) {
      const source = real(`src/i18n/locales/${locale}.ts`);
      const result = registerLocale(spec, locale)(source);

      // The first module also gets a blank line between its import and the rest of the file.
      const isFirstModule = !source.includes("from '@modules/");
      expect(result.split('\n')).toHaveLength(source.split('\n').length + (isFirstModule ? 3 : 2));
      expect(result).toContain(`import { ${locale}ZzProbe as zzProbe } from '@modules/zz-probe';`);
      expect(result).toContain('  zzProbe: zzProbe.zzProbe,');
    }
  });

  it('has the .env.example sections `gen env` inserts into', () => {
    const source = real('.env.example');

    const server = insertEnvEntry('ZZ_PROBE_VAR', '# probe\nZZ_PROBE_VAR=', false)(source);
    const lines = server.split('\n');
    expect(lines.indexOf('ZZ_PROBE_VAR=')).toBeLessThan(
      lines.findIndex((line) => /^# \d+\. Public/.test(line)),
    );

    expect(
      insertEnvEntry('NEXT_PUBLIC_ZZ_PROBE', '# probe\nNEXT_PUBLIC_ZZ_PROBE=', true)(source),
    ).toMatch(/NEXT_PUBLIC_ZZ_PROBE=\n$/);
  });

  it('has app-shell messages and a namespace in every module catalog that `gen translation` can extend', () => {
    for (const locale of ['en', 'de']) {
      expect(() =>
        addMessage(
          'app.json',
          undefined,
          'zzProbe.value',
          'x',
        )(real(`${PATHS.appMessages}/${locale}.json`)),
      ).not.toThrow();
    }

    // `src/modules` is created with the first module.
    const modulesDir = join(REAL_ROOT, 'src/modules');
    const modules = (existsSync(modulesDir) ? readdirSync(modulesDir) : []).filter((name) =>
      existsSync(join(modulesDir, name, 'presentation/i18n/en.json')),
    );
    for (const name of modules) {
      const namespace = name.replace(/-(\w)/g, (_, char: string) => char.toUpperCase());
      for (const locale of ['en', 'de']) {
        const path = `src/modules/${name}/presentation/i18n/${locale}.json`;
        expect(
          () => addMessage(path, namespace, 'zzProbe.value', 'x')(real(path)),
          path,
        ).not.toThrow();
      }
    }
  });

  it('would generate a module here without conflicts, and writes nothing', async () => {
    const output = await runModule(['zz-probe', '--fields', 'name:string', '--dry-run'], {
      root: REAL_ROOT,
    });

    expect(output).toContain('Would create 36 file(s):');
    expect(output).toContain('Would edit 2 file(s):');
    expect(existsSync(join(REAL_ROOT, 'src/modules/zz-probe'))).toBe(false);
  });

  // Needs a module in the standard shape; the first generated one is the reference.
  it.skipIf(!existsSync(join(REAL_ROOT, 'src/modules/profile')))(
    'can still extend the profile module, the reference for the standard shape',
    async () => {
      const output = await runUseCase(['zz-probe-thing', '-m', 'profile', '--dry-run'], {
        root: REAL_ROOT,
      });

      expect(output).toContain('Would create 1 file(s):');
      expect(output).toContain('Would edit 1 file(s):');
      expect(
        existsSync(join(REAL_ROOT, 'src/modules/profile/application/commands/zz-probe-thing.ts')),
      ).toBe(false);
    },
  );

  it('formats through the real Prettier config, idempotently', async () => {
    expect(existsSync(join(REAL_ROOT, '.prettierrc.json'))).toBe(true);

    const once = await formatSource(
      REAL_ROOT,
      'src/probe.ts',
      "import {b} from './b'\nexport const a = {b}\n",
    );

    expect(await formatSource(REAL_ROOT, 'src/probe.ts', once)).toBe(once);
  });
});

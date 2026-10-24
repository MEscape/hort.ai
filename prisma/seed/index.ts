import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { isBoolean, isFiniteNumber, isString, objectOf, optional } from '@lib/utils';

import { say, tally } from './seed-context';

import type { SeedContext, SeedModule } from './seed-types';

const seedDirectory = path.dirname(fileURLToPath(import.meta.url));

/** Only files named `<name>.seed.ts` are seed modules; the helpers beside them are not. */
const SEED_FILE = /^[a-z0-9-]+\.seed\.ts$/;

const DEFAULT_SEED_ORDER = 100;

const hasDefaultSeed = objectOf<{ default: SeedModule }>({
  default: objectOf<SeedModule>({
    name: isString,
    order: optional(isFiniteNumber),
    enabled: optional(isBoolean),
    run: (value): value is SeedModule['run'] => typeof value === 'function',
  }),
});

async function discoverSeeds(): Promise<SeedModule[]> {
  const files = (await readdir(seedDirectory)).filter((file) => SEED_FILE.test(file)).sort();

  const modules: SeedModule[] = [];

  for (const file of files) {
    const imported: unknown = await import(pathToFileURL(path.join(seedDirectory, file)).href);

    if (!hasDefaultSeed(imported)) {
      throw new Error(
        `Invalid seed module "${file}". Expected a default export with a name and run(context) function.`,
      );
    }

    modules.push(imported.default);
  }

  // Explicit order first, name as a stable tie-breaker.
  return modules.sort(
    (a, b) =>
      (a.order ?? DEFAULT_SEED_ORDER) - (b.order ?? DEFAULT_SEED_ORDER) ||
      a.name.localeCompare(b.name),
  );
}

export async function runSeeds(): Promise<void> {
  const context: SeedContext = { say, tally };

  for (const seed of await discoverSeeds()) {
    if (seed.enabled === false) {
      say(`Skipping disabled seed: ${seed.name}`);
      continue;
    }

    say(`Running seed: ${seed.name}`);
    await seed.run(context);
  }

  say(`Seed done: ${tally.created} created, ${tally.skipped} already there.`);
}

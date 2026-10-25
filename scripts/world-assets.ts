#!/usr/bin/env tsx
/**
 * Prepares the island pictures of every world area in a working folder outside the repository
 * (art direction and workflow: `docs/architecture/world.md`):
 *
 *   npm run world:assets -- --dir <folder>
 *
 * For every asset of the island catalog it writes `<areaId>/<assetId>.prompt.txt` (the shared
 * style prompt, the asset's brief and its context). Where a generated master `<assetId>.png` lies
 * next to it, it checks it (transparent, large enough) and cuts the delivered 4:3 WebP widths
 * `<assetId>-<width>.webp`, padding a master of another aspect ratio with transparency. The list it
 * prints is in generation order (cohesion set, MVP, rest) and says what each asset still needs.
 * It uploads nothing and calls no network service; Sharp comes with Next.js.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import sharp from 'sharp';

import { ISLAND_IMAGE_WIDTHS, WORLD_AREAS, islandCatalog } from '@modules/world';
import type { WorldArea } from '@modules/world';

import { STYLE_PROMPT, composePrompt, generationOrder, masterIssues } from './lib/world-assets';

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const ASPECT = 3 / 4;

/** Cuts the delivered widths from a valid master; returns what is wrong with it otherwise. */
async function deliver(master: string, dir: string, assetId: string): Promise<readonly string[]> {
  const issues = masterIssues(await sharp(master).metadata());
  if (issues.length > 0) {
    return issues;
  }
  for (const width of ISLAND_IMAGE_WIDTHS) {
    await sharp(master)
      .resize(width, Math.round(width * ASPECT), { fit: 'contain', background: TRANSPARENT })
      .webp({ quality: 82, alphaQuality: 90, effort: 6 })
      .toFile(join(dir, `${assetId}-${width}.webp`));
  }
  return [];
}

async function main(): Promise<number> {
  const { values } = parseArgs({ options: { dir: { type: 'string' } } });
  if (values.dir === undefined) {
    process.stderr.write(
      'world-assets: --dir <folder> is required (prompts and masters live there).\n',
    );
    return 1;
  }
  const workDir = resolve(values.dir);
  const islands: ReadonlyMap<string, (typeof islandCatalog.islands)[number]> = new Map(
    islandCatalog.islands.map((island) => [island.areaId, island]),
  );
  const counts = { missing: 0, ready: 0, fix: 0 };

  const areas: readonly WorldArea[] = WORLD_AREAS;
  for (const area of generationOrder(areas)) {
    const island = islands.get(area.id);
    if (island === undefined) {
      process.stdout.write(`  FIX      ${area.id}: no island in the catalog\n`);
      counts.fix += 1;
      continue;
    }
    const dir = join(workDir, area.id);
    mkdirSync(dir, { recursive: true });
    for (const asset of island.assets) {
      writeFileSync(
        join(dir, `${asset.id}.prompt.txt`),
        composePrompt(STYLE_PROMPT, area, asset.brief),
      );
      const master = join(dir, `${asset.id}.png`);
      const issues = existsSync(master) ? await deliver(master, dir, asset.id) : null;
      const label = `${area.id}/${asset.id} (${asset.status}${area.mvp === true ? ', MVP' : ''})`;
      if (issues === null) {
        counts.missing += 1;
        process.stdout.write(`  generate ${label}\n`);
      } else if (issues.length > 0) {
        counts.fix += 1;
        process.stdout.write(`  FIX      ${label}: ${issues.join('; ')}\n`);
      } else {
        counts.ready += 1;
        process.stdout.write(`  upload   ${label}: ${ISLAND_IMAGE_WIDTHS.join(' and ')} px cut\n`);
      }
    }
  }
  process.stdout.write(
    `\nworld assets: ${counts.ready} ready to upload, ${counts.missing} to generate, ${counts.fix} to fix\n`,
  );
  return counts.fix === 0 ? 0 : 1;
}

process.exitCode = await main();

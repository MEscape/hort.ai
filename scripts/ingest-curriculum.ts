#!/usr/bin/env tsx
/**
 * Ingests official curriculum source texts into the database the environment points at (#28).
 *
 *   npm run curriculum:ingest                          # every prisma/curriculum/*.curriculum.txt
 *   npm run curriculum:ingest -- <file> [<file> …]     # only these
 *
 * Idempotent: an unchanged text reports `unchanged`, so it is safe to run after every deploy.
 * A new federal state or document version is a new text file, never a code change. Prints only
 * keys, versions and counts, never the database URL.
 */
import 'dotenv/config';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { curriculumCommands } from '@modules/curriculum';

import { disconnectDb } from '@lib/db';

const SOURCE_DIRECTORY = join(process.cwd(), 'prisma/curriculum');

function sourceFiles(args: readonly string[]): string[] {
  if (args.length > 0) {
    return [...args];
  }
  return readdirSync(SOURCE_DIRECTORY)
    .filter((file) => file.endsWith('.curriculum.txt'))
    .sort()
    .map((file) => join(SOURCE_DIRECTORY, file));
}

async function main(): Promise<void> {
  let failed = 0;
  for (const file of sourceFiles(process.argv.slice(2))) {
    const result = await curriculumCommands.ingestCurriculumDocument.execute(
      readFileSync(file, 'utf8'),
    );
    if (result.isOk()) {
      const { sourceKey, version, outcome, statementCount, truncatedCount } = result.value;
      process.stdout.write(
        `${sourceKey}@${version}: ${outcome}, ${statementCount} statements, ${truncatedCount} truncated\n`,
      );
    } else {
      failed += 1;
      const fields = 'fieldErrors' in result.error ? JSON.stringify(result.error.fieldErrors) : '';
      process.stderr.write(`${file}: ${result.error.code} ${fields}\n`);
    }
  }
  process.exitCode = failed > 0 ? 1 : 0;
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`curriculum:ingest failed: ${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());

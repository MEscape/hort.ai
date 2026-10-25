import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { curriculumCommands } from '@modules/curriculum';

import type { SeedModule } from './seed-types';

const SOURCE_DIRECTORY = join(process.cwd(), 'prisma/curriculum');

/**
 * Ingests every `prisma/curriculum/*.curriculum.txt` (#28): the Hessian curriculum and the KMK
 * fallback for maths, grades 3 and 4. Idempotent; the same as `npm run curriculum:ingest`.
 */
const curriculumSeed: SeedModule = {
  name: 'curriculum',
  order: 10,
  async run(context) {
    const counts = context.tally;
    const files = readdirSync(SOURCE_DIRECTORY)
      .filter((file) => file.endsWith('.curriculum.txt'))
      .sort();
    for (const file of files) {
      const result = await curriculumCommands.ingestCurriculumDocument.execute(
        readFileSync(join(SOURCE_DIRECTORY, file), 'utf8'),
      );
      if (result.isErr()) {
        throw new Error(`Curriculum ${file} was not ingested: ${result.error.code}`);
      }
      const { sourceKey, outcome, statementCount } = result.value;
      context.say(`curriculum ${sourceKey}: ${outcome} (${statementCount} statements)`);
      if (outcome === 'unchanged') {
        counts.skipped += 1;
      } else {
        counts.created += 1;
      }
    }
  },
};

// eslint-disable-next-line import/no-default-export -- the seed runner loads each seed module's default export
export default curriculumSeed;

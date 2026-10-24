/**
 * migrations/apply-auth-migration.ts
 *
 * Applies the auth-owned SQL migrations in migrations/auth/ (in file-name order), which live
 * outside the Prisma schema. Run via: npm run db:migrate:auth
 *
 * Each migration is idempotent (IF NOT EXISTS / ON CONFLICT guards), so re-running is safe in
 * both development and production. A new migration is a new numbered file; an applied one is
 * never edited.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { config } from 'dotenv';
import { Pool } from 'pg';

// .env sits in the repository root, one level above migrations/.
const repoRoot = resolve(import.meta.dirname, '..');
config({ path: join(repoRoot, '.env') });

const MIGRATIONS_DIR = join(repoRoot, 'migrations', 'auth');

async function listMigrations(): Promise<string[]> {
  const files = await readdir(MIGRATIONS_DIR);
  return files.filter((file) => file.endsWith('.sql')).sort();
}

async function applyMigration(pool: Pool, file: string): Promise<void> {
  await pool.query(await readFile(join(MIGRATIONS_DIR, file), 'utf-8'));
  process.stdout.write(`  applied: ${file}\n`);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
  const url = process.env['AUTH_DATABASE_URL'];
  if (!url) {
    process.stdout.write('AUTH_DATABASE_URL is not set — skipping auth migrations.\n');
    return;
  }

  const migrations = await listMigrations();
  process.stdout.write(`Applying ${migrations.length} auth migration(s)...\n`);

  const pool = new Pool({ connectionString: url });

  try {
    for (const file of migrations) {
      await applyMigration(pool, file);
    }
    process.stdout.write('Auth migrations complete.\n');
  } catch (error) {
    process.stderr.write(`Auth migration failed: ${describe(error)}\n`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`Unexpected error: ${describe(error)}\n`);
  process.exitCode = 1;
});

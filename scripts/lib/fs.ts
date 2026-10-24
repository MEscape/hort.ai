import {
  closeSync,
  existsSync,
  readdirSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  rmdirSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CliError } from './args';

/** The repository root, derived from this file (never from the working directory). */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

interface PlannedCreate {
  readonly rel: string;
  readonly content: string;
}

interface PlannedEdit {
  readonly rel: string;
  readonly transform: (current: string) => string;
}

export interface PlanSummary {
  readonly created: readonly string[];
  readonly edited: readonly string[];
}

/**
 * A set of file changes that is validated as a whole before anything is
 * written.
 *
 * - Every path must stay inside the repository root (no absolute paths,
 *   `..` segments, or symlink escapes).
 * - A file that already exists is a conflict; there is no overwrite mode.
 *   All conflicts are reported at once and nothing is written.
 * - Edits of existing files compute their new content first. A transform
 *   that does not recognise the file's shape throws, which aborts the
 *   whole plan.
 * - If a write fails midway, everything already written is rolled back.
 */
export class Plan {
  private readonly creates: PlannedCreate[] = [];
  private readonly edits: PlannedEdit[] = [];
  private readonly root: string;

  constructor(root: string = REPO_ROOT) {
    this.root = realpathSync(path.resolve(root));
  }

  create(rel: string, content: string): void {
    if (this.creates.some((entry) => entry.rel === rel) || this.edits.some((e) => e.rel === rel)) {
      throw new Error(`Internal error: "${rel}" is planned twice.`);
    }
    this.creates.push({ rel, content });
  }

  edit(rel: string, transform: (current: string) => string): void {
    if (this.creates.some((entry) => entry.rel === rel) || this.edits.some((e) => e.rel === rel)) {
      throw new Error(`Internal error: "${rel}" is planned twice.`);
    }
    this.edits.push({ rel, transform });
  }

  /** Reads an existing file through the same root checks (for generators that inspect first). */
  read(rel: string): string {
    const abs = this.resolve(rel);
    if (!existsSync(abs) || !lstatSync(abs).isFile()) {
      throw new CliError(`Expected file not found: ${rel}`);
    }
    return readFileSync(abs, 'utf8');
  }

  /** Names inside an existing directory (empty if it does not exist). */
  list(rel: string): string[] {
    const abs = this.resolve(rel);
    return existsSync(abs) && lstatSync(abs).isDirectory() ? readdirSync(abs).sort() : [];
  }

  exists(rel: string): boolean {
    return existsSync(this.resolve(rel));
  }

  /** Absolute path of `rel`, guaranteed to be inside the root. */
  resolve(rel: string): string {
    if (rel.length === 0 || rel.includes('\0') || path.isAbsolute(rel) || rel.includes('\\')) {
      throw new CliError(`Unsafe path "${rel}".`);
    }
    const abs = path.resolve(this.root, rel);
    const relative = path.relative(this.root, abs);
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new CliError(`Path "${rel}" is outside the repository.`);
    }
    // The nearest existing ancestor must also resolve inside the root (symlink escape).
    let probe = abs;
    while (!existsSync(probe)) {
      probe = path.dirname(probe);
    }
    const real = realpathSync(probe);
    if (real !== this.root && !real.startsWith(this.root + path.sep)) {
      throw new CliError(`Path "${rel}" resolves outside the repository.`);
    }
    return abs;
  }

  /** Checks everything and returns the final content of every edit. Writes nothing. */
  validate(): Map<string, { original: string; next: string }> {
    for (const entry of this.creates) {
      this.resolve(entry.rel);
    }

    const conflicts = this.creates.filter((entry) => existsSync(this.resolve(entry.rel)));
    if (conflicts.length > 0) {
      throw new CliError(
        [
          `Refusing to overwrite ${conflicts.length} existing file(s); nothing was written:`,
          ...conflicts.map((entry) => `  ${entry.rel}`),
          'Remove them (or choose another name) and run the command again.',
        ].join('\n'),
      );
    }

    const edited = new Map<string, { original: string; next: string }>();
    for (const entry of this.edits) {
      const original = this.read(entry.rel);
      const next = entry.transform(original);
      edited.set(entry.rel, { original, next });
    }
    return edited;
  }

  summary(): PlanSummary {
    return {
      created: this.creates.map((entry) => entry.rel).sort(),
      edited: this.edits.map((entry) => entry.rel).sort(),
    };
  }

  /** Validates, then writes. With `dryRun` only validates. */
  commit(options: { dryRun?: boolean } = {}): PlanSummary {
    const edited = this.validate();
    if (options.dryRun === true) {
      return this.summary();
    }

    const createdFiles: string[] = [];
    const createdDirs: string[] = [];
    const editedFiles: Array<{ abs: string; original: string }> = [];

    try {
      for (const entry of this.creates) {
        const abs = this.resolve(entry.rel);
        for (const dir of missingDirs(path.dirname(abs))) {
          mkdirSync(dir);
          createdDirs.push(dir);
        }
        // 'wx' fails if the file appeared since validation.
        const fd = openSync(abs, 'wx');
        createdFiles.push(abs);
        try {
          writeSync(fd, entry.content);
        } finally {
          closeSync(fd);
        }
      }
      for (const [rel, { original, next }] of edited) {
        const abs = this.resolve(rel);
        if (readFileSync(abs, 'utf8') !== original) {
          throw new CliError(`"${rel}" changed while generating; aborting.`);
        }
        editedFiles.push({ abs, original });
        writeFileSync(abs, next);
      }
    } catch (error) {
      for (const { abs, original } of editedFiles.reverse()) {
        writeFileSync(abs, original);
      }
      for (const abs of createdFiles.reverse()) {
        rmSync(abs, { force: true });
      }
      for (const dir of createdDirs.reverse()) {
        try {
          rmdirSync(dir);
        } catch {
          // Not empty: someone else wrote there; leave it.
        }
      }
      if (error instanceof CliError) {
        throw error;
      }
      throw new CliError(
        `Writing failed and was rolled back: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return this.summary();
  }
}

/** Directories from the first missing ancestor down to `dir`, outermost first. */
function missingDirs(dir: string): string[] {
  const missing: string[] = [];
  let current = dir;
  while (!existsSync(current)) {
    missing.unshift(current);
    current = path.dirname(current);
  }
  return missing;
}

/** Human-readable summary of what a plan did (or would do). */
export function formatSummary(summary: PlanSummary, dryRun: boolean): string {
  const verb = dryRun ? 'Would create' : 'Created';
  const editVerb = dryRun ? 'Would edit' : 'Edited';
  const sections: string[] = [];
  if (summary.created.length > 0) {
    sections.push(
      `${verb} ${summary.created.length} file(s):`,
      ...summary.created.map((file) => `  + ${file}`),
    );
  }
  if (summary.edited.length > 0) {
    sections.push(
      `${editVerb} ${summary.edited.length} file(s):`,
      ...summary.edited.map((file) => `  ~ ${file}`),
    );
  }
  return sections.join('\n');
}

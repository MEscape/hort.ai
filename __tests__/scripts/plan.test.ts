import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { Plan, formatSummary } from '../../scripts/lib/fs';

import { changedPaths, linkDirectory, makeOutside, makeRepo, snapshot } from './helpers';

function emptyRoot(): string {
  return makeRepo();
}

describe('Plan: writing', () => {
  it('creates files with their parent directories and reports them sorted', () => {
    const root = emptyRoot();
    const plan = new Plan(root);
    plan.create('src/deep/er/b.txt', 'b');
    plan.create('src/a.txt', 'a');

    const summary = plan.commit();

    expect(summary).toEqual({ created: ['src/a.txt', 'src/deep/er/b.txt'], edited: [] });
    expect(readFileSync(join(root, 'src/deep/er/b.txt'), 'utf8')).toBe('b');
    expect(readFileSync(join(root, 'src/a.txt'), 'utf8')).toBe('a');
  });

  it('applies an edit to an existing file', () => {
    const root = emptyRoot();
    writeFileSync(join(root, 'notes.txt'), 'one');
    const plan = new Plan(root);
    plan.edit('notes.txt', (current) => `${current}-two`);

    expect(plan.commit().edited).toEqual(['notes.txt']);
    expect(readFileSync(join(root, 'notes.txt'), 'utf8')).toBe('one-two');
  });

  it('writes nothing on a dry run, not even directories', () => {
    const root = emptyRoot();
    const before = snapshot(root);
    const plan = new Plan(root);
    plan.create('new/dir/file.txt', 'x');

    const summary = plan.commit({ dryRun: true });

    expect(summary.created).toEqual(['new/dir/file.txt']);
    expect(existsSync(join(root, 'new'))).toBe(false);
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it('refuses to plan the same path twice', () => {
    const plan = new Plan(emptyRoot());
    plan.create('a.txt', '1');
    expect(() => {
      plan.create('a.txt', '2');
    }).toThrow(/planned twice/);
    expect(() => {
      plan.edit('a.txt', (x) => x);
    }).toThrow(/planned twice/);
  });
});

describe('Plan: conflicts', () => {
  it('reports every existing target at once and writes nothing, not even the free ones', () => {
    const root = emptyRoot();
    writeFileSync(join(root, 'one.txt'), 'mine-1');
    writeFileSync(join(root, 'two.txt'), 'mine-2');
    const before = snapshot(root);
    const plan = new Plan(root);
    plan.create('one.txt', 'new');
    plan.create('free.txt', 'new');
    plan.create('two.txt', 'new');

    expect(() => plan.commit()).toThrow(
      /Refusing to overwrite 2 existing file\(s\)[\s\S]*one\.txt[\s\S]*two\.txt/,
    );
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it('treats an existing directory at a file path as a conflict', () => {
    const root = emptyRoot();
    mkdirSync(join(root, 'taken'));
    const plan = new Plan(root);
    plan.create('taken', 'x');

    expect(() => plan.commit()).toThrow(/Refusing to overwrite/);
  });

  it('keeps hand-written content on a repeated run', () => {
    const root = emptyRoot();
    const first = new Plan(root);
    first.create('src/a.ts', 'generated');
    first.commit();
    writeFileSync(join(root, 'src/a.ts'), 'hand-written');

    const second = new Plan(root);
    second.create('src/a.ts', 'generated');

    expect(() => second.commit()).toThrow(/Refusing to overwrite/);
    expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe('hand-written');
  });
});

describe('Plan: path safety', () => {
  it.each([
    ['../escape.txt', /outside the repository|Unsafe path/],
    ['a/../../escape.txt', /outside the repository/],
    ['/etc/escape.txt', /Unsafe path/],
    ['a\\b.txt', /Unsafe path/],
    ['a\0b.txt', /Unsafe path/],
    ['', /Unsafe path/],
    ['.', /outside the repository|Unsafe path/],
  ])('rejects %j', (path, message) => {
    const plan = new Plan(emptyRoot());
    plan.create(path, 'x');

    expect(() => plan.commit({ dryRun: true })).toThrow(message);
  });

  it('rejects a symlinked directory that leads out of the repository', () => {
    const root = emptyRoot();
    const outside = makeOutside();
    linkDirectory(outside, join(root, 'link'));
    const plan = new Plan(root);
    plan.create('link/file.txt', 'x');

    expect(() => plan.commit()).toThrow(/resolves outside the repository/);
    expect(existsSync(join(outside, 'file.txt'))).toBe(false);
  });

  it('rejects editing a file through an escaping symlink', () => {
    const root = emptyRoot();
    const outside = makeOutside();
    writeFileSync(join(outside, 'secret.txt'), 'untouched');
    linkDirectory(outside, join(root, 'link'));
    const plan = new Plan(root);
    plan.edit('link/secret.txt', () => 'pwned');

    expect(() => plan.commit()).toThrow(/resolves outside the repository/);
    expect(readFileSync(join(outside, 'secret.txt'), 'utf8')).toBe('untouched');
  });

  it('is independent of the working directory', () => {
    const root = emptyRoot();
    const elsewhere = mkdtempSync(join(tmpdir(), 'cwd-'));
    const previous = process.cwd();
    process.chdir(elsewhere);
    try {
      const plan = new Plan(root);
      plan.create('src/a.txt', 'x');
      plan.commit();
    } finally {
      process.chdir(previous);
    }
    expect(existsSync(join(root, 'src/a.txt'))).toBe(true);
    expect(existsSync(join(elsewhere, 'src'))).toBe(false);
  });
});

describe('Plan: failures leave no partial result', () => {
  it('aborts before writing when an edit transform does not recognise the file', () => {
    const root = emptyRoot();
    writeFileSync(join(root, 'config.txt'), 'unexpected shape');
    const before = snapshot(root);
    const plan = new Plan(root);
    plan.create('src/new.txt', 'x');
    plan.edit('config.txt', () => {
      throw new Error('shape not recognised');
    });

    expect(() => plan.commit()).toThrow('shape not recognised');
    expect(changedPaths(before, snapshot(root))).toEqual([]);
  });

  it('fails clearly when an edited file does not exist', () => {
    const plan = new Plan(emptyRoot());
    plan.edit('missing.txt', (x) => x);

    expect(() => plan.commit()).toThrow(/Expected file not found: missing\.txt/);
  });

  it('rolls back created files and directories when a later write fails', () => {
    const root = emptyRoot();
    writeFileSync(join(root, 'blocked'), 'a file where a directory is needed');
    const before = snapshot(root);
    const plan = new Plan(root);
    plan.create('first/ok.txt', 'x');
    plan.create('blocked/never.txt', 'x');

    expect(() => plan.commit()).toThrow(/rolled back/);
    expect(changedPaths(before, snapshot(root))).toEqual([]);
    expect(existsSync(join(root, 'first'))).toBe(false);
  });

  it('does not overwrite a file that changed while generating', () => {
    const root = emptyRoot();
    const target = join(root, 'shared.txt');
    writeFileSync(target, 'original');
    const plan = new Plan(root);
    plan.create('src/new.txt', 'x');
    plan.edit('shared.txt', () => {
      writeFileSync(target, 'changed by someone else');
      return 'ours';
    });

    expect(() => plan.commit()).toThrow(/changed while generating/);
    expect(readFileSync(target, 'utf8')).toBe('changed by someone else');
    expect(existsSync(join(root, 'src/new.txt'))).toBe(false);
  });
});

describe('Plan: reading and summaries', () => {
  it('lists, reads and checks existence through the same root checks', () => {
    const root = emptyRoot();
    mkdirSync(join(root, 'dir'));
    writeFileSync(join(root, 'dir/b.txt'), 'b');
    writeFileSync(join(root, 'dir/a.txt'), 'a');
    const plan = new Plan(root);

    expect(plan.list('dir')).toEqual(['a.txt', 'b.txt']);
    expect(plan.list('nope')).toEqual([]);
    expect(plan.read('dir/a.txt')).toBe('a');
    expect(plan.exists('dir')).toBe(true);
    expect(() => plan.read('../x')).toThrow(/outside the repository/);
    expect(() => plan.list('../x')).toThrow(/outside the repository/);
  });

  it('formats a summary without empty sections and with dry-run wording', () => {
    expect(formatSummary({ created: ['a'], edited: [] }, false)).toBe('Created 1 file(s):\n  + a');
    expect(formatSummary({ created: [], edited: ['b'] }, true)).toBe(
      'Would edit 1 file(s):\n  ~ b',
    );
    expect(formatSummary({ created: ['a'], edited: ['b'] }, true)).toBe(
      'Would create 1 file(s):\n  + a\nWould edit 1 file(s):\n  ~ b',
    );
  });
});

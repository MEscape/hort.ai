import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Agent skills ship twice: `.agents/skills` (Codex, Gemini CLI) and `.claude/skills` (Claude
 * Code). Copies rather than symlinks, because symlinked skills are not discovered reliably and
 * break on Windows checkouts. This keeps the two trees identical and every skill loadable.
 */
const ROOT = process.cwd();
const TREES = ['.agents/skills', '.claude/skills'] as const;

function skillsIn(tree: string): Record<string, string> {
  const dir = join(ROOT, tree);
  if (!existsSync(dir)) return {};
  return Object.fromEntries(
    readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => [entry.name, readFileSync(join(dir, entry.name, 'SKILL.md'), 'utf8')]),
  );
}

const [agents, claude] = TREES.map(skillsIn);

describe('agent skills', () => {
  it('ships the same skills, byte for byte, in both trees', () => {
    expect(claude).toEqual(agents);
  });

  it.each(Object.entries(agents))(
    '%s has frontmatter naming it and saying when to use it',
    (name, source) => {
      const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(source)?.[1] ?? '';
      expect(frontmatter).toMatch(new RegExp(`^name: ${name}$`, 'm'));
      expect(frontmatter).toMatch(/^description: Use when .{20,}$/m);
    },
  );

  it('lists every skill in AGENTS.md', () => {
    const agentsMd = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8');
    for (const name of Object.keys(agents)) {
      expect(agentsMd).toContain(`\`${name}\``);
    }
  });
});

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { deriveOwnedTables } from '../../eslint/policy/ownership.mjs';
import { OWNER_SCOPE_KINDS, OWNERSHIP } from '../../eslint/policy/policy.mjs';

describe('deriveOwnedTables', () => {
  it('returns an empty mapping when no owner columns are declared', () => {
    const contract = {
      storage: {
        namespaces: {
          public: {
            entries: {
              table: {
                Child: { columns: { id: {}, parentId: {} } },
              },
            },
          },
        },
      },
    };
    expect(deriveOwnedTables(contract, [])).toEqual({});
  });

  it('pins tables by declared owner columns and detects self-owner tables via id check', () => {
    const contract = {
      storage: {
        namespaces: {
          public: {
            entries: {
              table: {
                Profile: {
                  columns: { id: {}, ownerId: {}, name: {} },
                  checks: [{ expression: '"id" = "ownerId"' }],
                },
                Activity: {
                  columns: { id: {}, ownerId: {}, score: {} },
                },
                GlobalConfig: {
                  columns: { id: {}, key: {}, value: {} },
                },
              },
            },
          },
        },
      },
    };

    const owned = deriveOwnedTables(contract, ['ownerId']);
    expect(owned.Profile).toEqual({ pins: ['ownerId', 'id'] });
    expect(owned.Activity).toEqual({ pins: ['ownerId'] });
    expect(owned.GlobalConfig).toBeUndefined();
  });

  it('resolves child tables to their owned parent via foreign key chains', () => {
    const contract = {
      storage: {
        namespaces: {
          public: {
            entries: {
              table: {
                User: {
                  columns: { id: {}, accountId: {} },
                },
                Post: {
                  columns: { id: {}, userId: {} },
                  foreignKeys: [{ target: { tableName: 'User' } }],
                },
                Comment: {
                  columns: { id: {}, postId: {} },
                  foreignKeys: [{ target: { tableName: 'Post' } }],
                },
                SystemLog: {
                  columns: { id: {}, msg: {} },
                },
              },
            },
          },
        },
      },
    };

    const owned = deriveOwnedTables(contract, ['accountId']);
    expect(owned.User).toEqual({ pins: ['accountId'] });
    expect(owned.Post).toEqual({ pins: [], via: 'User' });
    expect(owned.Comment).toEqual({ pins: [], via: 'Post' });
    expect(owned.SystemLog).toBeUndefined();
  });
});

/** Every `@owner-scope <kind> <reason>` in infrastructure: ways data is reached without a pinned owner. */
function findOwnerScopeTags(): Array<{ file: string; kind: string; reason: string }> {
  const modulesDir = join(process.cwd(), 'src/modules');
  const found: Array<{ file: string; kind: string; reason: string }> = [];
  if (!existsSync(modulesDir)) {
    return found;
  }
  const tagPattern = new RegExp(`@${OWNERSHIP.tag}\\s+([\\w-]+)\\s*(.*?)\\s*(?:\\*\\/)?$`);

  for (const entry of readdirSync(modulesDir, { recursive: true }) as string[]) {
    const path = entry.split(String.fromCharCode(92)).join('/');
    if (!/\/infrastructure\/.+\.ts$/.test(path)) {
      continue;
    }
    const content = readFileSync(join(modulesDir, path), 'utf8');
    for (const line of content.split('\n')) {
      const match = tagPattern.exec(line);
      if (match?.[1] && match[2]) {
        found.push({
          file: path,
          kind: match[1],
          reason: match[2].trim(),
        });
      }
    }
  }
  return found;
}

describe('the ways data is reached without a pinned owner', () => {
  it('only use kinds the policy knows and declare a meaningful reason', () => {
    const kinds = Object.keys(OWNER_SCOPE_KINDS);
    const tags = findOwnerScopeTags();

    for (const tag of tags) {
      expect(
        kinds,
        `Tag '${tag.kind}' in ${tag.file} must be one of: ${kinds.join(', ')}`,
      ).toContain(tag.kind);
      expect(
        tag.reason.length,
        `Tag in ${tag.file} needs a reason of at least 20 characters`,
      ).toBeGreaterThanOrEqual(20);
    }
  });
});

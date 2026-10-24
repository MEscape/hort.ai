/**
 * Which tables are owned, and what pins a query on them, derived from the Prisma contract. Nothing here names a
 * table: the policy names only the owner columns (`OWNERSHIP.columns`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { OWNERSHIP } from './policy.mjs';

const tablesOf = (contract) => contract?.storage?.namespaces?.public?.entries?.table ?? {};

/**
 * `{ [table]: { pins: string[], via?: string } }` for every table `columns` reaches:
 *  - `pins`: the owner columns the table has (plus `id` when the table refuses any row whose column differs from
 *    its own id: it IS its own owner). A query that constrains one of them is bound to one owner.
 *  - `via`: a table without an owner column of its own, owned through the first foreign key that leads to an
 *    owned table (a child of a child resolves through the chain).
 * A table that neither has an owner column nor leads to an owned table is global data and is absent.
 */
export function deriveOwnedTables(contract, columns) {
  const tables = tablesOf(contract);
  const owned = {};
  if (columns.length === 0) return owned;

  for (const [name, table] of Object.entries(tables)) {
    const own = columns.filter((column) => column in (table.columns ?? {}));
    const isItsOwnOwner = columns.some((column) =>
      (table.checks ?? []).some(({ expression }) => expression === `"id" = "${column}"`),
    );
    const pins = isItsOwnOwner ? [...own, 'id'] : own;
    if (pins.length > 0) owned[name] = { pins };
  }

  for (let changed = true; changed;) {
    changed = false;
    for (const [name, table] of Object.entries(tables)) {
      if (name in owned) continue;
      const parent = (table.foreignKeys ?? [])
        .map(({ target }) => target.tableName)
        .find((candidate) => candidate in owned);
      if (parent !== undefined) {
        owned[name] = { pins: [], via: parent };
        changed = true;
      }
    }
  }
  return owned;
}

const cache = new Map();

/** The ownership facts of the repository at `root`; dormant (no tables) when no owner column is declared. */
export function loadOwnership(root = process.cwd()) {
  if (cache.has(root)) return cache.get(root);
  const path = join(root, OWNERSHIP.contractFile);
  const contract = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  const ownership = {
    columns: OWNERSHIP.columns,
    tag: OWNERSHIP.tag,
    tables: deriveOwnedTables(contract, OWNERSHIP.columns),
  };
  cache.set(root, ownership);
  return ownership;
}

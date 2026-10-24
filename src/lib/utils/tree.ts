/**
 * Generic tree and forest traversal. The caller supplies how to find children, so these helpers
 * know nothing about any node shape. Domain-specific tree rules (for example duplicate-id
 * detection) belong in the owning module and build on these (architecture.md: "shared code must be
 * genuinely generic; do not extract module code prematurely").
 *
 * Traversal is recursive, one stack frame per level of depth: bound the depth of any tree that
 * comes from untrusted input before walking it (`isJsonValue(value, maxDepth)`). The `…Forest`
 * functions take a list of roots; the others take a single root.
 */

export type GetChildren<T> = (node: T) => readonly T[] | undefined;

/** Rebuilds a node around a new children array. The write-side counterpart of `GetChildren`. */
export type WithChildren<T> = (node: T, children: readonly T[]) => T;

/** How to read and rebuild the nodes of a tree made of immutable values. */
export interface TreeShape<T> {
  readonly getChildren: GetChildren<T>;
  readonly withChildren: WithChildren<T>;
}

/** A node with its position in a flattened forest. `depth` is zero-based: roots are 0. */
export interface ForestEntry<T> {
  readonly node: T;
  readonly parent: T | null;
  readonly depth: number;
}

/** Where a node sits among its siblings. */
export interface ForestLocation<T> {
  readonly node: T;
  readonly parent: T | null;
  readonly siblings: readonly T[];
  readonly index: number;
}

/** Visits every node depth-first, parents before children. */
export function walkTree<T>(
  node: T,
  getChildren: GetChildren<T>,
  visit: (node: T, depth: number) => void,
  depth = 0,
): void {
  visit(node, depth);
  for (const child of getChildren(node) ?? []) {
    walkTree(child, getChildren, visit, depth + 1);
  }
}

/** Counts every node, including the root. */
export function countNodes<T>(root: T, getChildren: GetChildren<T>): number {
  let count = 0;
  walkTree(root, getChildren, () => {
    count += 1;
  });
  return count;
}

/**
 * Returns a new tree with `transform` applied to every node. `transform`
 * rebuilds a node around its already-transformed children, so the input
 * tree is never mutated.
 */
export function mapTree<T, U>(
  root: T,
  getChildren: GetChildren<T>,
  transform: (node: T, children: U[]) => U,
): U {
  const children = (getChildren(root) ?? []).map((child) => mapTree(child, getChildren, transform));
  return transform(root, children);
}

/**
 * Returns the path of nodes from the root to the first node matching the
 * predicate, or `undefined` when nothing matches.
 */
export function findPath<T>(
  root: T,
  getChildren: GetChildren<T>,
  predicate: (node: T) => boolean,
): T[] | undefined {
  if (predicate(root)) {
    return [root];
  }
  for (const child of getChildren(root) ?? []) {
    const path = findPath(child, getChildren, predicate);
    if (path) {
      return [root, ...path];
    }
  }
  return undefined;
}

/** Every node of a forest depth-first, parents before children, with its parent and depth. */
export function flattenForest<T>(
  roots: readonly T[],
  getChildren: GetChildren<T>,
): Array<ForestEntry<T>> {
  const entries: Array<ForestEntry<T>> = [];
  const visit = (nodes: readonly T[], parent: T | null, depth: number): void => {
    for (const node of nodes) {
      entries.push({ node, parent, depth });
      visit(getChildren(node) ?? [], node, depth + 1);
    }
  };
  visit(roots, null, 0);
  return entries;
}

/** The first node (depth-first) matching the predicate, with its siblings, index and parent. */
export function locateInForest<T>(
  roots: readonly T[],
  getChildren: GetChildren<T>,
  predicate: (node: T) => boolean,
  parent: T | null = null,
): ForestLocation<T> | undefined {
  for (const [index, node] of roots.entries()) {
    if (predicate(node)) {
      return { node, parent, siblings: roots, index };
    }
    const found = locateInForest(getChildren(node) ?? [], getChildren, predicate, node);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

/** `findPath` over a forest: the path from a root to the first match, or `undefined`. */
export function findPathInForest<T>(
  roots: readonly T[],
  getChildren: GetChildren<T>,
  predicate: (node: T) => boolean,
): T[] | undefined {
  for (const root of roots) {
    const path = findPath(root, getChildren, predicate);
    if (path !== undefined) {
      return path;
    }
  }
  return undefined;
}

/**
 * Applies `transform` to every node, parents before children. Returns the
 * input array itself when nothing changed, and reuses every subtree that
 * did not change (structural sharing).
 */
export function updateForest<T>(
  roots: readonly T[],
  shape: TreeShape<T>,
  transform: (node: T) => T,
): readonly T[] {
  const next = roots.map((node) => {
    const mapped = transform(node);
    const children = shape.getChildren(mapped) ?? [];
    const updatedChildren = updateForest(children, shape, transform);
    return updatedChildren !== children ? shape.withChildren(mapped, updatedChildren) : mapped;
  });
  // Nothing changed when every node came back as the very same object.
  return next.every((node, index) => node === roots[index]) ? roots : next;
}

/**
 * Removes every node matching the predicate together with its subtree.
 * Returns the input array itself when nothing matched, and reuses every
 * subtree that did not change (structural sharing).
 */
export function removeFromForest<T>(
  roots: readonly T[],
  shape: TreeShape<T>,
  predicate: (node: T) => boolean,
): readonly T[] {
  let changed = false;
  const kept: T[] = [];
  for (const node of roots) {
    if (predicate(node)) {
      changed = true;
      continue;
    }
    const children = shape.getChildren(node) ?? [];
    const keptChildren = removeFromForest(children, shape, predicate);
    if (keptChildren !== children) {
      changed = true;
      kept.push(shape.withChildren(node, keptChildren));
    } else {
      kept.push(node);
    }
  }
  return changed ? kept : roots;
}

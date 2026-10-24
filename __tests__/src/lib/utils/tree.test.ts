import { describe, expect, it } from 'vitest';

import {
  countNodes,
  findPathInForest,
  flattenForest,
  locateInForest,
  mapTree,
  removeFromForest,
  updateForest,
  type TreeShape,
} from '@lib/utils';
import { findPath, walkTree } from '@lib/utils/tree';

interface Node {
  readonly id: string;
  readonly children?: readonly Node[];
}

const leaf = (id: string): Node => ({ id });
const node = (id: string, ...children: Node[]): Node => ({ id, children });

const getChildren = (n: Node): readonly Node[] | undefined => n.children;
const shape: TreeShape<Node> = {
  getChildren,
  withChildren: (n, children) => ({ ...n, children }),
};

//   a            d
//  / \           |
// b   c          e
//     |
//     f
const a = node('a', leaf('b'), node('c', leaf('f')));
const d = node('d', leaf('e'));
const forest: readonly Node[] = [a, d];

const ids = (nodes: readonly Node[]): string[] => nodes.map((n) => n.id);

describe('walkTree and countNodes', () => {
  it('visits parents before children, depth first, with depth', () => {
    const visited: Array<[string, number]> = [];
    walkTree(a, getChildren, (n, depth) => visited.push([n.id, depth]));
    expect(visited).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 1],
      ['f', 2],
    ]);
  });

  it('counts every node including the root', () => {
    expect(countNodes(a, getChildren)).toBe(4);
    expect(countNodes(leaf('x'), getChildren)).toBe(1);
  });
});

describe('mapTree', () => {
  it('rebuilds nodes around their transformed children without mutating the input', () => {
    const label = mapTree<Node, string>(
      a,
      getChildren,
      (n, children) => `${n.id}${children.length > 0 ? `(${children.join(',')})` : ''}`,
    );
    expect(label).toBe('a(b,c(f))');
    expect(a.children).toHaveLength(2);
  });
});

describe('findPath and findPathInForest', () => {
  it('returns the path from the root to the first match', () => {
    expect(ids(findPath(a, getChildren, (n) => n.id === 'f') ?? [])).toEqual(['a', 'c', 'f']);
    expect(ids(findPath(a, getChildren, (n) => n.id === 'a') ?? [])).toEqual(['a']);
  });

  it('returns undefined when nothing matches', () => {
    expect(findPath(a, getChildren, () => false)).toBeUndefined();
    expect(findPathInForest(forest, getChildren, () => false)).toBeUndefined();
  });

  it('searches every root of a forest', () => {
    expect(ids(findPathInForest(forest, getChildren, (n) => n.id === 'e') ?? [])).toEqual([
      'd',
      'e',
    ]);
    expect(findPathInForest([], getChildren, () => true)).toBeUndefined();
  });
});

describe('flattenForest', () => {
  it('lists nodes depth first with parent and zero-based depth', () => {
    expect(
      flattenForest(forest, getChildren).map((e) => [e.node.id, e.parent?.id, e.depth]),
    ).toEqual([
      ['a', undefined, 0],
      ['b', 'a', 1],
      ['c', 'a', 1],
      ['f', 'c', 2],
      ['d', undefined, 0],
      ['e', 'd', 1],
    ]);
  });

  it('is empty for an empty forest', () => {
    expect(flattenForest([], getChildren)).toEqual([]);
  });
});

describe('locateInForest', () => {
  it('finds a root with its siblings and index', () => {
    const found = locateInForest(forest, getChildren, (n) => n.id === 'd');
    expect(found).toEqual({ node: d, parent: null, siblings: forest, index: 1 });
  });

  it('finds a nested node with its parent and siblings', () => {
    const found = locateInForest(forest, getChildren, (n) => n.id === 'c');
    expect(found?.parent).toBe(a);
    expect(found?.siblings).toBe(a.children);
    expect(found?.index).toBe(1);
  });

  it('returns undefined when nothing matches', () => {
    expect(locateInForest(forest, getChildren, () => false)).toBeUndefined();
  });
});

describe('updateForest', () => {
  it('returns the input array itself when no node changed', () => {
    expect(updateForest(forest, shape, (n) => n)).toBe(forest);
  });

  it('rebuilds only the changed branch and shares the rest', () => {
    const result = updateForest(forest, shape, (n) => (n.id === 'f' ? { ...n, id: 'F' } : n));

    expect(result).not.toBe(forest);
    expect(result[1]).toBe(d);
    expect(result[0]).not.toBe(a);
    const [b, c] = result[0]?.children ?? [];
    expect(b).toBe(a.children?.[0]);
    expect(ids(c?.children ?? [])).toEqual(['F']);
    expect(a.children?.[1]?.children?.[0]?.id).toBe('f');
  });

  it('transforms parents before looking at their children', () => {
    const result = updateForest(forest, shape, (n) => (n.id === 'd' ? leaf('d') : n));
    expect(result[1]).toEqual({ id: 'd' });
  });
});

describe('removeFromForest', () => {
  it('returns the input array itself when nothing matched', () => {
    expect(removeFromForest(forest, shape, () => false)).toBe(forest);
  });

  it('removes matching roots together with their subtrees', () => {
    const result = removeFromForest(forest, shape, (n) => n.id === 'a');
    expect(result).toEqual([d]);
    expect(result[0]).toBe(d);
  });

  it('removes nested nodes, rebuilding ancestors and sharing untouched subtrees', () => {
    const result = removeFromForest(forest, shape, (n) => n.id === 'f');

    expect(result).not.toBe(forest);
    expect(result[1]).toBe(d);
    expect(flattenForest(result, getChildren).map((e) => e.node.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
    expect(a.children?.[1]?.children).toHaveLength(1);
  });

  it('keeps a node whose children are untouched as the same object', () => {
    const result = removeFromForest(forest, shape, (n) => n.id === 'e');
    expect(result[0]).toBe(a);
  });
});

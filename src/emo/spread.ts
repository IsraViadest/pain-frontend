/**
 * The order in which a network reaches the countries in it, starting from the one that was
 * clicked.
 *
 * A breadth-first search, which is the whole of it: the operator asked for the network to connect
 * "first from the country that we have, to all neighbour nodes, then from the neighbour node
 * branching out and so on", and that sentence is the definition of BFS. Kept as a pure function
 * over index pairs, separate from both the geometry that draws it and the clock that plays it,
 * because its one interesting property is measurable only in isolation: every node's depth is the
 * length of the shortest path to it, so the wave cannot arrive somewhere twice or arrive late.
 *
 * UNREACHED NODES ARRIVE, THEY DO NOT WAIT FOREVER. A category graph is not required to be
 * connected: `categoryGraph: "knn"` at k=1 leaves isolated pairs, and a category made of two
 * clusters has no path between them. Those nodes are placed one step past the deepest node the
 * search did reach, so they light up at the end of the animation rather than staying dark, which
 * would read as a bug rather than as a fact about the graph.
 */

/**
 * Where the wave is at each node, and how long the whole sweep takes, both in depth steps.
 * Not exported: arcs.ts takes it through inference on the return type, and the repo's ts-prune
 * gate fails any export nothing imports.
 */
interface EmoSpreadPlan {
  /** Depth of each node in the input's own indexing. */
  nodeDepth: number[];
  /** One past the deepest node, so a normalised time is `depth / span`. Never 0. */
  span: number;
}

/**
 * Breadth-first depths from `origin` over an undirected edge list.
 *
 * `count` is the number of nodes, not the number of edges: a category can contain a country that
 * no edge touches, and it still has to arrive.
 */
export function planSpread(
  edges: readonly (readonly [number, number])[],
  count: number,
  origin: number,
): EmoSpreadPlan {
  const adjacency: number[][] = Array.from({ length: count }, () => []);
  for (const [a, b] of edges) {
    if (a < 0 || b < 0 || a >= count || b >= count) continue;
    adjacency[a]!.push(b);
    adjacency[b]!.push(a);
  }

  const nodeDepth = new Array<number>(count).fill(-1);
  let deepest = 0;
  if (origin >= 0 && origin < count) {
    nodeDepth[origin] = 0;
    const queue = [origin];
    for (let head = 0; head < queue.length; head++) {
      const node = queue[head]!;
      const next = nodeDepth[node]! + 1;
      for (const neighbour of adjacency[node]!) {
        if (nodeDepth[neighbour] !== -1) continue;
        nodeDepth[neighbour] = next;
        if (next > deepest) deepest = next;
        queue.push(neighbour);
      }
    }
  }

  // Everything the search could not reach lands one step past the deepest thing it could.
  const unreachedDepth = deepest + 1;
  let anyUnreached = false;
  for (let i = 0; i < count; i++) {
    if (nodeDepth[i] === -1) {
      nodeDepth[i] = unreachedDepth;
      anyUnreached = true;
    }
  }

  return { nodeDepth, span: (anyUnreached ? unreachedDepth : deepest) + 1 };
}

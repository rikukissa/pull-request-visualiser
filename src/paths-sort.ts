import { GraphEdge, GraphNode } from "reagraph";

export function sort(paths: string[], sep = "/") {
  return paths
    .map((el) => el.split(sep))
    .sort((a, b) => {
      const l = Math.max(a.length, b.length);
      for (let i = 0; i < l; i++) {
        if (!(i in a)) return -1;
        if (!(i in b)) return 1;
        const comp = a[i].localeCompare(b[i], undefined, {
          sensitivity: "base",
        });
        if (comp !== 0) return comp;
      }
      return a.length - b.length; // Sort by length if all components are equal
    })
    .map((el) => el.join(sep));
}

function nodeDistanceFromRoot(
  node: GraphNode,
  nodes: GraphNode[],
  edges: GraphEdge[]
) {
  const edge = edges.find((e) => e.target === node.id);
  if (!edge) {
    return 0;
  }
  const parent = nodes.find((n) => n.id === edge.source);
  if (!parent) {
    return 0;
  }
  return 1 + nodeDistanceFromRoot(parent, nodes, edges);
}

export function sortNodes(nodes: GraphNode[], edges: GraphEdge[], sep = "/") {
  // tässä se "nestaus" level täytyy olla yks factor

  const sortedNodes = nodes.slice().sort((a, b) => {
    const distanceA = nodeDistanceFromRoot(a, nodes, edges);
    const distanceB = nodeDistanceFromRoot(b, nodes, edges);

    if (distanceA !== distanceB) {
      return distanceA - distanceB;
    }

    return a.id.localeCompare(b.id, undefined, { sensitivity: "base" });
  });
  console.log(
    sortedNodes.map((n) => [n.id, nodeDistanceFromRoot(n, nodes, edges)])
  );

  return sortedNodes;
}

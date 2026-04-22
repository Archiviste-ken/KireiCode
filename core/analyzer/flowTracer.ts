import type { AnalysisGraph } from "@/core/graph";

export interface FlowTracePath {
  startNodeId: string;
  traversedNodeIds: string[];
  traversedEdgeTypes: string[];
}

export function traceFlow(
  graph: AnalysisGraph,
  startNodeId: string,
  maxDepth = 4,
): FlowTracePath {
  const traversedNodeIds = new Set<string>([startNodeId]);
  const traversedEdgeTypes: string[] = [];
  let frontier = [startNodeId];
  let depth = 0;

  while (frontier.length > 0 && depth < maxDepth) {
    const nextFrontier: string[] = [];

    graph.edges.forEach((edge) => {
      if (!frontier.includes(edge.from)) {
        return;
      }

      traversedEdgeTypes.push(edge.type);

      if (!traversedNodeIds.has(edge.to)) {
        traversedNodeIds.add(edge.to);
        nextFrontier.push(edge.to);
      }
    });

    frontier = nextFrontier;
    depth += 1;
  }

  return {
    startNodeId,
    traversedNodeIds: [...traversedNodeIds],
    traversedEdgeTypes,
  };
}

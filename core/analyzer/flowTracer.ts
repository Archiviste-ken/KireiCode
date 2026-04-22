import type {
  AnalysisGraph,
  GraphEdgeType,
  GraphNode,
  GraphNodeType,
} from "@/core/graph";

export type FlowTraversalStrategy = "bfs" | "dfs";

export interface FlowExecutionStep {
  nodeId: string;
  label: string;
  type: GraphNodeType;
  filePath: string;
}

export interface ExecutionPath {
  nodeIds: string[];
  edgeTypes: GraphEdgeType[];
  steps: FlowExecutionStep[];
  readablePath: string;
}

export interface FlowTracePath {
  startNodeId: string;
  strategy: FlowTraversalStrategy;
  maxDepth: number;

  // Legacy compatibility fields.
  traversedNodeIds: string[];
  traversedEdgeTypes: string[];

  executionPath: ExecutionPath;
  executionPaths: ExecutionPath[];
}

interface TraversalState {
  currentNodeId: string;
  nodePath: string[];
  edgePath: GraphEdgeType[];
  depth: number;
}

function toNodeLookup(graph: AnalysisGraph): Map<string, GraphNode> {
  return new Map(graph.nodes.map((node) => [node.id, node]));
}

function toAdjacency(
  graph: AnalysisGraph,
): Map<string, Array<{ to: string; type: GraphEdgeType }>> {
  const adjacency = new Map<
    string,
    Array<{ to: string; type: GraphEdgeType }>
  >();

  graph.edges.forEach((edge) => {
    const current = adjacency.get(edge.from) ?? [];
    current.push({
      to: edge.to,
      type: edge.type,
    });
    adjacency.set(edge.from, current);
  });

  return adjacency;
}

function toExecutionPath(
  nodePath: string[],
  edgePath: GraphEdgeType[],
  nodeLookup: Map<string, GraphNode>,
): ExecutionPath {
  const steps = nodePath.map((nodeId) => {
    const node = nodeLookup.get(nodeId);
    return {
      nodeId,
      label: node?.label ?? nodeId,
      type: node?.type ?? "unknown",
      filePath: node?.filePath ?? "unknown",
    } satisfies FlowExecutionStep;
  });

  return {
    nodeIds: nodePath,
    edgeTypes: edgePath,
    steps,
    readablePath: steps.map((step) => step.label).join(" -> "),
  };
}

function pickPrimaryPath(paths: ExecutionPath[]): ExecutionPath {
  if (paths.length === 0) {
    return {
      nodeIds: [],
      edgeTypes: [],
      steps: [],
      readablePath: "",
    };
  }

  return paths.reduce((best, current) => {
    if (current.nodeIds.length > best.nodeIds.length) {
      return current;
    }

    return best;
  });
}

export function traceFlow(
  graph: AnalysisGraph,
  startNodeId: string,
  maxDepth = 4,
  strategy: FlowTraversalStrategy = "bfs",
): FlowTracePath {
  const nodeLookup = toNodeLookup(graph);
  const adjacency = toAdjacency(graph);

  const traversedNodeIds = new Set<string>();
  const traversedEdgeTypes: GraphEdgeType[] = [];
  const executionPaths: ExecutionPath[] = [];

  const startState: TraversalState = {
    currentNodeId: startNodeId,
    nodePath: [startNodeId],
    edgePath: [],
    depth: 0,
  };

  const frontier: TraversalState[] = [startState];

  while (frontier.length > 0) {
    const state = strategy === "dfs" ? frontier.pop() : frontier.shift();
    if (!state) {
      continue;
    }

    traversedNodeIds.add(state.currentNodeId);

    const outgoing = adjacency.get(state.currentNodeId) ?? [];
    const nextEdges = outgoing.filter(
      (edge) => !state.nodePath.includes(edge.to),
    );

    if (state.depth >= maxDepth || nextEdges.length === 0) {
      executionPaths.push(
        toExecutionPath(state.nodePath, state.edgePath, nodeLookup),
      );
      continue;
    }

    nextEdges.forEach((edge) => {
      traversedEdgeTypes.push(edge.type);
      traversedNodeIds.add(edge.to);

      frontier.push({
        currentNodeId: edge.to,
        nodePath: [...state.nodePath, edge.to],
        edgePath: [...state.edgePath, edge.type],
        depth: state.depth + 1,
      });
    });
  }

  const primaryPath = pickPrimaryPath(executionPaths);

  return {
    startNodeId,
    strategy,
    maxDepth,
    traversedNodeIds: [...traversedNodeIds],
    traversedEdgeTypes: traversedEdgeTypes.map((edgeType) => String(edgeType)),
    executionPath: primaryPath,
    executionPaths,
  };
}

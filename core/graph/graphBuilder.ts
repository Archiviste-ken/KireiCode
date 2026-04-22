import type { CodeRepositoryIR } from "@/core/ir";

import type { AnalysisGraph, GraphNode, GraphNodeType } from "./graphTypes";

function toGraphNodeType(kind: string): GraphNodeType {
  if (kind === "function" || kind === "api-call" || kind === "try-catch") {
    return kind;
  }
  return "unknown";
}

export function buildAnalysisGraph(
  repositoryIR: CodeRepositoryIR,
): AnalysisGraph {
  const nodes: GraphNode[] = [];
  const edges: AnalysisGraph["edges"] = [];
  const idMap = new Map<string, string>();

  repositoryIR.files.forEach((file) => {
    const fileNodeId = `file:${file.filePath}`;

    nodes.push({
      id: fileNodeId,
      filePath: file.filePath,
      type: "file",
      label: file.filePath,
      metadata: {
        language: file.language,
      },
    });

    file.nodes.forEach((node) => {
      const graphNodeId = `node:${node.id}`;
      idMap.set(node.id, graphNodeId);

      nodes.push({
        id: graphNodeId,
        filePath: file.filePath,
        type: toGraphNodeType(node.kind),
        label: node.name,
        location: node.location,
        metadata: node.metadata,
      });

      edges.push({
        from: fileNodeId,
        to: graphNodeId,
        type: "contains",
      });
    });

    file.nodes.forEach((node) => {
      if (!node.parentId) {
        return;
      }

      const parentGraphId = idMap.get(node.parentId);
      const childGraphId = idMap.get(node.id);

      if (!parentGraphId || !childGraphId) {
        return;
      }

      if (node.kind === "api-call") {
        edges.push({
          from: parentGraphId,
          to: childGraphId,
          type: "calls",
        });
        return;
      }

      if (node.kind === "try-catch") {
        edges.push({
          from: parentGraphId,
          to: childGraphId,
          type: "handles",
        });
      }
    });
  });

  return {
    nodes,
    edges,
  };
}

import type { SourceLocation } from "@/core/ir";

export type GraphNodeType =
  | "file"
  | "function"
  | "api-call"
  | "try-catch"
  | "unknown";
export type GraphEdgeType = "contains" | "calls" | "handles";

export interface GraphNode {
  id: string;
  filePath: string;
  type: GraphNodeType;
  label: string;
  location?: SourceLocation;
  metadata: Record<string, string | number | boolean>;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: GraphEdgeType;
}

export interface AnalysisGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

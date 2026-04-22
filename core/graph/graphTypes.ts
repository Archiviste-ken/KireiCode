import type { SourceLocation } from "@/core/ir";
import type { Graph } from "graphlib";

export type GraphNodeType =
  | "file"
  | "function"
  | "api-endpoint"
  | "db-resource"
  | "api-call"
  | "try-catch"
  | "unknown";

export type GraphEdgeType =
  | "IMPORT"
  | "CALL"
  | "API_FLOW"
  | "DB_ACCESS"
  | "contains"
  | "calls"
  | "handles";

export type GraphLayer = "CORE" | "API_FLOW" | "DB_ACCESS";

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
  layer?: GraphLayer;
  metadata?: Record<string, string | number | boolean>;
}

export interface AnalysisGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  directedGraph?: Graph;
  layers?: {
    apiFlowEnabled: boolean;
    dbAccessEnabled: boolean;
  };
}

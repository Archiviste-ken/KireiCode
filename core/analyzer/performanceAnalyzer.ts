import type { AnalysisGraph } from "@/core/graph";
import type { GraphNode } from "@/core/graph";
import { RULE_SEVERITY_WEIGHT } from "@/utils";

export type PerformanceIssueType = "PERFORMANCE" | "BUG" | "RISK";
export type PerformanceIssueCode =
  | "NESTED_LOOPS"
  | "BLOCKING_SYNC_IO"
  | "HEAVY_LOOP_DATA_FLOW";
export type PerformanceIssueSeverity = "low" | "medium" | "high";

export interface PerformanceIssue {
  code: PerformanceIssueCode;
  type: PerformanceIssueType;
  severity: PerformanceIssueSeverity;
  file: string;
  function: string;
  message: string;
  confidenceScore: number;
}

export interface PerformanceAnalysis {
  score: number;
  riskLevel: "low" | "medium" | "high";
}

export interface RuleAnalysisResult {
  performance: PerformanceAnalysis;
  issues: PerformanceIssue[];

  // Compatibility alias used by existing pipeline and API contracts.
  findings: PerformanceIssue[];
}

const LOOP_COMPLEXITY_HIGH_THRESHOLD = 8;
const LOOP_COMPLEXITY_MEDIUM_THRESHOLD = 6;

const BLOCKING_SYNC_CALL_HINTS = ["fs.readfilesync", "readfilesync"];

const API_CALL_HINTS = [
  "api",
  "http",
  "fetch",
  "axios",
  "request",
  "graphql",
  "client.",
  "service.",
];

const DB_CALL_HINTS = [
  "db",
  "prisma",
  "sequelize",
  "mongoose",
  "knex",
  "repository",
  "model.",
  "query",
  "find",
  "insert",
  "update",
  "delete",
  "save",
  "aggregate",
];

function toNumber(value: string | number | boolean | undefined): number | null {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function includesAnyHint(input: string, hints: string[]): boolean {
  const normalized = input.toLowerCase();
  return hints.some((hint) => normalized.includes(hint));
}

function getFunctionNodes(graph: AnalysisGraph): GraphNode[] {
  return graph.nodes.filter((node) => node.type === "function");
}

function getOutgoingCallTargets(
  graph: AnalysisGraph,
  nodeLookup: Map<string, GraphNode>,
  functionNodeId: string,
): GraphNode[] {
  return graph.edges
    .filter(
      (edge) =>
        edge.from === functionNodeId &&
        (edge.type === "CALL" || edge.type === "calls"),
    )
    .map((edge) => nodeLookup.get(edge.to))
    .filter((node): node is GraphNode => Boolean(node));
}

function hasLoopSignal(functionNode: GraphNode): boolean {
  const loopDepth = toNumber(functionNode.metadata.loopDepth);
  if (loopDepth !== null && loopDepth > 0) {
    return true;
  }

  const loopCount = toNumber(functionNode.metadata.loopCount);
  if (loopCount !== null && loopCount > 0) {
    return true;
  }

  const complexity = toNumber(functionNode.metadata.complexity);
  if (complexity !== null && complexity >= LOOP_COMPLEXITY_MEDIUM_THRESHOLD) {
    return true;
  }

  return false;
}

function detectNestedLoops(graph: AnalysisGraph): PerformanceIssue[] {
  return getFunctionNodes(graph)
    .filter((functionNode) => {
      const loopDepth = toNumber(functionNode.metadata.loopDepth);
      if (loopDepth !== null) {
        return loopDepth >= 2;
      }

      const loopCount = toNumber(functionNode.metadata.loopCount);
      if (loopCount !== null) {
        return loopCount >= 2;
      }

      const complexity = toNumber(functionNode.metadata.complexity);
      return (
        complexity !== null && complexity >= LOOP_COMPLEXITY_HIGH_THRESHOLD
      );
    })
    .map((functionNode) => ({
      code: "NESTED_LOOPS" as const,
      type: "PERFORMANCE" as const,
      severity: "high" as const,
      file: functionNode.filePath,
      function: functionNode.label,
      message: `Function ${functionNode.label} shows nested-loop characteristics with high control-flow complexity.`,
      confidenceScore: 0.88,
    }));
}

function detectBlockingSyncCalls(graph: AnalysisGraph): PerformanceIssue[] {
  const nodeLookup = new Map(graph.nodes.map((node) => [node.id, node]));

  return getFunctionNodes(graph).flatMap((functionNode) => {
    const callTargets = getOutgoingCallTargets(
      graph,
      nodeLookup,
      functionNode.id,
    );

    const blockingTargets = callTargets.filter((targetNode) => {
      const endpoint = String(targetNode.metadata.endpoint ?? targetNode.label);
      return includesAnyHint(endpoint, BLOCKING_SYNC_CALL_HINTS);
    });

    if (blockingTargets.length === 0) {
      return [];
    }

    return [
      {
        code: "BLOCKING_SYNC_IO" as const,
        type: "PERFORMANCE" as const,
        severity: "high" as const,
        file: functionNode.filePath,
        function: functionNode.label,
        message: `Function ${functionNode.label} invokes blocking sync IO (${blockingTargets
          .map((target) => target.label)
          .join(", ")}).`,
        confidenceScore: 0.95,
      },
    ];
  });
}

function detectHeavyLoopDataFlow(graph: AnalysisGraph): PerformanceIssue[] {
  const nodeLookup = new Map(graph.nodes.map((node) => [node.id, node]));

  return getFunctionNodes(graph).flatMap((functionNode) => {
    if (!hasLoopSignal(functionNode)) {
      return [];
    }

    const callTargets = getOutgoingCallTargets(
      graph,
      nodeLookup,
      functionNode.id,
    );
    const dataCalls = callTargets.filter((targetNode) => {
      const targetSignature = String(
        targetNode.metadata.endpoint ?? targetNode.label,
      );
      return (
        includesAnyHint(targetSignature, API_CALL_HINTS) ||
        includesAnyHint(targetSignature, DB_CALL_HINTS)
      );
    });

    // Avoid naive detection: require at least 2 data/API calls while loop signal exists.
    if (dataCalls.length < 2) {
      return [];
    }

    return [
      {
        code: "HEAVY_LOOP_DATA_FLOW" as const,
        type: "PERFORMANCE" as const,
        severity: "high" as const,
        file: functionNode.filePath,
        function: functionNode.label,
        message: `Function ${functionNode.label} combines loop-heavy flow with repeated DB/API calls (${dataCalls.length} call sites).`,
        confidenceScore: 0.86,
      },
    ];
  });
}

function deduplicateIssues(issues: PerformanceIssue[]): PerformanceIssue[] {
  const unique = new Map<string, PerformanceIssue>();

  issues.forEach((issue) => {
    const key = `${issue.code}:${issue.file}:${issue.function}:${issue.message}`;
    if (!unique.has(key)) {
      unique.set(key, issue);
    }
  });

  return [...unique.values()];
}

function deriveRiskLevel(score: number): "low" | "medium" | "high" {
  if (score < 50) {
    return "high";
  }

  if (score < 80) {
    return "medium";
  }

  return "low";
}

export function analyzePerformance(graph: AnalysisGraph): RuleAnalysisResult {
  const issues = deduplicateIssues([
    ...detectNestedLoops(graph),
    ...detectBlockingSyncCalls(graph),
    ...detectHeavyLoopDataFlow(graph),
  ]);

  const totalWeight = issues.reduce((accumulator, issue) => {
    return accumulator + RULE_SEVERITY_WEIGHT[issue.severity];
  }, 0);

  const score = Math.max(0, 100 - totalWeight * 4);

  return {
    issues,
    findings: issues,
    performance: {
      score,
      riskLevel: deriveRiskLevel(score),
    },
  };
}

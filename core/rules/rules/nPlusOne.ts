import type { AnalysisGraph } from "@/core/graph";

import type { AnalysisRule, RuleFinding } from "../ruleEngine";

const API_CALL_HINTS = [
  "api",
  "http",
  "fetch",
  "axios",
  "request",
  "graphql",
  "client.get",
  "client.post",
  "client.put",
  "client.patch",
  "client.delete",
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
  "findone",
  "findmany",
  "insert",
  "update",
  "delete",
  "save",
  "aggregate",
];

const BATCH_SAFE_HINTS = ["batch", "bulk", "many", "all", "list"];

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

function toBool(value: string | number | boolean | undefined): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return null;
}

function includesAnyHint(input: string, hints: string[]): boolean {
  const normalized = input.toLowerCase();
  return hints.some((hint) => normalized.includes(hint));
}

function isDataAccessOrApiCall(label: string): boolean {
  return (
    includesAnyHint(label, API_CALL_HINTS) ||
    includesAnyHint(label, DB_CALL_HINTS)
  );
}

function isBatchSafeCall(label: string): boolean {
  return includesAnyHint(label, BATCH_SAFE_HINTS);
}

function hasLoopSignal(
  metadata: Record<string, string | number | boolean>,
): boolean {
  // Preferred signal (if parser starts emitting it): explicit loop count.
  const loopCount = toNumber(metadata.loopCount);
  if (loopCount !== null && loopCount > 0) {
    return true;
  }

  // Fallback signal: higher cyclomatic complexity strongly suggests looping/branching.
  const complexity = toNumber(metadata.complexity);
  if (complexity !== null && complexity >= 4) {
    return true;
  }

  // Additional future-proof signal: parser-provided flag.
  const inLoopHint = toBool(metadata.hasLoop);
  if (inLoopHint === true) {
    return true;
  }

  return false;
}

export const nPlusOneRule: AnalysisRule = {
  id: "n-plus-one",
  description:
    "Detect potential N+1 patterns where looped logic repeatedly triggers DB/API calls.",
  evaluate(graph: AnalysisGraph): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const nodeLookup = new Map(graph.nodes.map((node) => [node.id, node]));

    // Group calls by source function and callee to detect repeated same-call patterns.
    const callGroups = new Map<
      string,
      {
        sourceFunctionId: string;
        sourceFunctionLabel: string;
        sourceFilePath: string;
        calleeId: string;
        calleeLabel: string;
        callCount: number;
      }
    >();

    graph.edges
      .filter((edge) => edge.type === "CALL" || edge.type === "calls")
      .forEach((edge) => {
        const sourceNode = nodeLookup.get(edge.from);
        const calleeNode = nodeLookup.get(edge.to);

        if (!sourceNode || !calleeNode || sourceNode.type !== "function") {
          return;
        }

        const key = `${sourceNode.id}::${calleeNode.id}`;
        const current = callGroups.get(key);

        if (!current) {
          callGroups.set(key, {
            sourceFunctionId: sourceNode.id,
            sourceFunctionLabel: sourceNode.label,
            sourceFilePath: sourceNode.filePath,
            calleeId: calleeNode.id,
            calleeLabel: calleeNode.label,
            callCount: 1,
          });
          return;
        }

        current.callCount += 1;
      });

    callGroups.forEach((group) => {
      if (group.callCount < 2) {
        return;
      }

      const sourceNode = nodeLookup.get(group.sourceFunctionId);
      if (!sourceNode || sourceNode.type !== "function") {
        return;
      }

      // Avoid naive detection: require loop evidence + repeated call + DB/API signal.
      const loopDetected = hasLoopSignal(sourceNode.metadata);
      const dataOrApiCall = isDataAccessOrApiCall(group.calleeLabel);
      const batchSafe = isBatchSafeCall(group.calleeLabel);

      if (!loopDetected || !dataOrApiCall || batchSafe) {
        return;
      }

      findings.push({
        ruleId: "n-plus-one",
        title: "Potential N+1 query pattern",
        message:
          `Function ${group.sourceFunctionLabel} repeatedly calls ${group.calleeLabel} ` +
          `(${group.callCount} times) with loop-like control flow.`,
        severity: group.callCount >= 3 ? "high" : "medium",
        filePath: group.sourceFilePath,
        nodeId: group.sourceFunctionId,
      });
    });

    return findings;
  },
};

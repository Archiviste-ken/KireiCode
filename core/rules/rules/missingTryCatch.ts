import type { AnalysisGraph } from "@/core/graph";

import type { AnalysisRule, RuleFinding } from "../ruleEngine";

function toBoolean(value: string | number | boolean | undefined): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }

  return false;
}

export const missingTryCatchRule: AnalysisRule = {
  id: "missing-try-catch",
  description: "Find async functions that are not protected by try/catch.",
  evaluate(graph: AnalysisGraph): RuleFinding[] {
    const findings: RuleFinding[] = [];

    // Legacy fallback: older graph shape represented try/catch as handles edges.
    const protectedFunctionIds = new Set(
      graph.edges
        .filter((edge) => edge.type === "handles")
        .map((edge) => edge.from),
    );

    graph.nodes
      .filter((node) => node.type === "function")
      .forEach((functionNode) => {
        const isAsyncFunction = toBoolean(functionNode.metadata.async);
        if (!isAsyncFunction) {
          return;
        }

        const hasTryCatchInMetadata = toBoolean(
          functionNode.metadata.hasTryCatch,
        );
        const hasTryCatchProtection =
          hasTryCatchInMetadata || protectedFunctionIds.has(functionNode.id);

        if (hasTryCatchProtection) {
          return;
        }

        findings.push({
          ruleId: "missing-try-catch",
          title: "Async function missing try/catch",
          message: `Async function ${functionNode.label} is not wrapped in try/catch.`,
          severity: "high",
          filePath: functionNode.filePath,
          nodeId: functionNode.id,
        });
      });

    return findings;
  },
};

import type { AnalysisGraph } from "@/core/graph";

import type { AnalysisRule, RuleFinding } from "../ruleEngine";

export const missingTryCatchRule: AnalysisRule = {
  id: "missing-try-catch",
  description: "Find functions that execute logic with no try/catch guard.",
  evaluate(graph: AnalysisGraph): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const protectedFunctionIds = new Set(
      graph.edges
        .filter((edge) => edge.type === "handles")
        .map((edge) => edge.from),
    );

    graph.nodes
      .filter((node) => node.type === "function")
      .forEach((functionNode) => {
        if (protectedFunctionIds.has(functionNode.id)) {
          return;
        }

        findings.push({
          ruleId: "missing-try-catch",
          title: "Function without error boundary",
          message: `Function ${functionNode.label} has no try/catch protection.`,
          severity: "medium",
          filePath: functionNode.filePath,
          nodeId: functionNode.id,
        });
      });

    return findings;
  },
};

import type { AnalysisGraph } from "@/core/graph";

import type { AnalysisRule, RuleFinding } from "../ruleEngine";

export const nPlusOneRule: AnalysisRule = {
  id: "n-plus-one",
  description: "Detect repeated API endpoint calls inside the same function.",
  evaluate(graph: AnalysisGraph): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const nodeLookup = new Map(graph.nodes.map((node) => [node.id, node]));
    const callCounters = new Map<string, number>();

    graph.edges
      .filter((edge) => edge.type === "calls")
      .forEach((edge) => {
        const parentNode = nodeLookup.get(edge.from);
        const apiNode = nodeLookup.get(edge.to);

        if (!parentNode || !apiNode || apiNode.type !== "api-call") {
          return;
        }

        const endpoint = String(apiNode.metadata.endpoint ?? apiNode.label);
        const key = `${parentNode.id}:${endpoint}`;
        const nextCount = (callCounters.get(key) ?? 0) + 1;
        callCounters.set(key, nextCount);

        if (nextCount === 3) {
          findings.push({
            ruleId: "n-plus-one",
            title: "Potential N+1 API access",
            message: `Function ${parentNode.label} calls ${endpoint} repeatedly (${nextCount} times).`,
            severity: "high",
            filePath: apiNode.filePath,
            nodeId: parentNode.id,
          });
        }
      });

    return findings;
  },
};

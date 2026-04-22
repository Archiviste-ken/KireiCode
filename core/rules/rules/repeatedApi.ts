import type { AnalysisGraph } from "@/core/graph";

import type { AnalysisRule, RuleFinding } from "../ruleEngine";

export const repeatedApiRule: AnalysisRule = {
  id: "repeated-api",
  description: "Detect the same API endpoint reused across multiple files.",
  evaluate(graph: AnalysisGraph): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const endpointToFiles = new Map<string, Set<string>>();

    graph.nodes
      .filter((node) => node.type === "api-call")
      .forEach((apiNode) => {
        const endpoint = String(apiNode.metadata.endpoint ?? apiNode.label);
        const files = endpointToFiles.get(endpoint) ?? new Set<string>();
        files.add(apiNode.filePath);
        endpointToFiles.set(endpoint, files);
      });

    endpointToFiles.forEach((files, endpoint) => {
      if (files.size < 3) {
        return;
      }

      findings.push({
        ruleId: "repeated-api",
        title: "API endpoint duplicated across files",
        message: `Endpoint ${endpoint} appears in ${files.size} files; consider centralizing access logic.`,
        severity: "low",
      });
    });

    return findings;
  },
};

import type { AnalysisGraph } from "@/core/graph";
import { RULE_SEVERITY_WEIGHT } from "@/utils";

import { runRuleEngine } from "@/core/rules";

export interface PerformanceAnalysis {
  score: number;
  riskLevel: "low" | "medium" | "high";
}

export interface RuleAnalysisResult {
  performance: PerformanceAnalysis;
  findings: ReturnType<typeof runRuleEngine>;
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
  const findings = runRuleEngine(graph);

  const totalWeight = findings.reduce((accumulator, finding) => {
    return accumulator + RULE_SEVERITY_WEIGHT[finding.severity];
  }, 0);

  const score = Math.max(0, 100 - totalWeight * 4);

  return {
    findings,
    performance: {
      score,
      riskLevel: deriveRiskLevel(score),
    },
  };
}

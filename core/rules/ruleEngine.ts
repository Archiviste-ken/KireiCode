import type { AnalysisGraph } from "@/core/graph";

import { missingTryCatchRule, nPlusOneRule, repeatedApiRule } from "./rules";

export type RuleSeverity = "low" | "medium" | "high";

export interface RuleFinding {
  ruleId: string;
  title: string;
  message: string;
  severity: RuleSeverity;
  filePath?: string;
  nodeId?: string;
}

export interface AnalysisRule {
  id: string;
  description: string;
  evaluate(graph: AnalysisGraph): RuleFinding[];
}

export function runRuleEngine(
  graph: AnalysisGraph,
  rules: AnalysisRule[] = [nPlusOneRule, missingTryCatchRule, repeatedApiRule],
): RuleFinding[] {
  return rules.flatMap((rule) => rule.evaluate(graph));
}

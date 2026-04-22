import type { AnalysisGraph } from "@/core/graph";
import { buildAnalysisGraph } from "@/core/graph";
import type { CodeRepositoryIR, IRFunction } from "@/core/ir";

import { missingTryCatchRule, nPlusOneRule, repeatedApiRule } from "./rules";

export type RuleSeverity = "low" | "medium" | "high";
export type IssueType = "PERFORMANCE" | "BUG" | "RISK";

export interface RuleIssue {
  rule: string;
  type: IssueType;
  severity: RuleSeverity;
  file: string;
  function: string;
  message: string;
  confidenceScore: number;
}

// Legacy compatibility with existing graph-first rules.
export interface RuleFinding {
  ruleId: string;
  title: string;
  message: string;
  severity: RuleSeverity;
  filePath?: string;
  nodeId?: string;
}

// Legacy compatibility with existing graph-first rules.
export interface AnalysisRule {
  id: string;
  description: string;
  evaluate(graph: AnalysisGraph): RuleFinding[];
}

export interface RuleContext {
  ir: CodeRepositoryIR;
  graph: AnalysisGraph;
}

export interface RulePlugin {
  id: string;
  evaluate(context: RuleContext): RuleIssue[];
}

export interface RuleEngineOptions {
  plugins?: RulePlugin[];
  minConfidenceScore?: number;
}

const DEFAULT_CONFIDENCE_THRESHOLD = 0;

function collectFunctions(ir: CodeRepositoryIR): IRFunction[] {
  return ir.files.flatMap((file) => file.functions ?? []);
}

const nPlusOnePlugin: RulePlugin = {
  id: "nPlusOne",
  evaluate(context: RuleContext): RuleIssue[] {
    return collectFunctions(context.ir).flatMap((fn) => {
      const callCountByTarget = new Map<string, number>();

      fn.functionCalls.forEach((call) => {
        const key = call.calleeName;
        callCountByTarget.set(key, (callCountByTarget.get(key) ?? 0) + 1);
      });

      return [...callCountByTarget.entries()]
        .filter(([, count]) => count >= 3)
        .map(([calleeName, count]) => ({
          rule: "nPlusOne",
          type: "PERFORMANCE" as const,
          severity: "high" as const,
          file: fn.filePath,
          function: fn.name,
          message: `Function ${fn.name} calls ${calleeName} ${count} times in the same scope.`,
          confidenceScore: 0.9,
        }));
    });
  },
};

const missingTryCatchPlugin: RulePlugin = {
  id: "missingTryCatch",
  evaluate(context: RuleContext): RuleIssue[] {
    return collectFunctions(context.ir)
      .filter((fn) => !fn.hasTryCatch)
      .map((fn) => ({
        rule: "missingTryCatch",
        type: "RISK" as const,
        severity: "medium" as const,
        file: fn.filePath,
        function: fn.name,
        message: `Function ${fn.name} has no try/catch protection.`,
        confidenceScore: 0.95,
      }));
  },
};

const repeatedApiCallsPlugin: RulePlugin = {
  id: "repeatedApiCalls",
  evaluate(context: RuleContext): RuleIssue[] {
    const callSitesByCallee = new Map<
      string,
      Array<{ filePath: string; functionName: string }>
    >();

    collectFunctions(context.ir).forEach((fn) => {
      fn.functionCalls.forEach((call) => {
        const sites = callSitesByCallee.get(call.calleeName) ?? [];
        sites.push({
          filePath: fn.filePath,
          functionName: fn.name,
        });
        callSitesByCallee.set(call.calleeName, sites);
      });
    });

    const issues: RuleIssue[] = [];

    callSitesByCallee.forEach((sites, calleeName) => {
      const fileCount = new Set(sites.map((site) => site.filePath)).size;
      if (fileCount < 3) {
        return;
      }

      sites.forEach((site) => {
        issues.push({
          rule: "repeatedApiCalls",
          type: "PERFORMANCE",
          severity: "low",
          file: site.filePath,
          function: site.functionName,
          message: `${calleeName} appears across ${fileCount} files. Consider a shared API abstraction.`,
          confidenceScore: 0.8,
        });
      });
    });

    return issues;
  },
};

export const defaultPlugins: RulePlugin[] = [
  nPlusOnePlugin,
  missingTryCatchPlugin,
  repeatedApiCallsPlugin,
];

function isCodebaseIR(
  input: AnalysisGraph | CodeRepositoryIR,
): input is CodeRepositoryIR {
  return "files" in input;
}

export function runRuleEngine(
  ir: CodeRepositoryIR,
  options?: RuleEngineOptions,
): RuleIssue[];
export function runRuleEngine(
  graph: AnalysisGraph,
  rules?: AnalysisRule[],
): RuleFinding[];
export function runRuleEngine(
  input: AnalysisGraph | CodeRepositoryIR,
  optionsOrRules?: RuleEngineOptions | AnalysisRule[],
): RuleIssue[] | RuleFinding[] {
  if (!isCodebaseIR(input)) {
    const rules = (optionsOrRules as AnalysisRule[] | undefined) ?? [
      nPlusOneRule,
      missingTryCatchRule,
      repeatedApiRule,
    ];

    return rules.flatMap((rule) => rule.evaluate(input));
  }

  const options = optionsOrRules as RuleEngineOptions | undefined;
  const plugins = options?.plugins ?? defaultPlugins;
  const minConfidenceScore =
    options?.minConfidenceScore ?? DEFAULT_CONFIDENCE_THRESHOLD;
  const context: RuleContext = {
    ir: input,
    graph: buildAnalysisGraph(input),
  };

  return plugins
    .flatMap((plugin) => plugin.evaluate(context))
    .filter((issue) => issue.confidenceScore >= minConfidenceScore);
}

import type { RepositoryAnalysisResult } from "@/core";

import { GroqClient } from "./groqClient";

export interface LegacyExplanationInput {
  prompt: string;
  analysis: RepositoryAnalysisResult;
}

export interface IssueData {
  type: "PERFORMANCE" | "BUG" | "RISK";
  severity: "low" | "medium" | "high";
  file: string;
  function: string;
  message: string;
  confidenceScore: number;
  source?: string;
  rule?: string;
  code?: string;
}

export interface IssueExplanationInput {
  issue: IssueData;
}

export interface IssueExplanationOutput {
  explanation: string;
  impact: string;
  fixSuggestion: string;
}

function buildSummary(analysis: RepositoryAnalysisResult): string {
  return [
    `Files analyzed: ${analysis.fileCount}`,
    `IR nodes: ${analysis.irStats.totalNodes}`,
    `Graph: ${analysis.graphStats.totalNodes} nodes / ${analysis.graphStats.totalEdges} edges`,
    `Performance score: ${analysis.performance.score}`,
    `Findings: ${analysis.findings.length}`,
  ].join("\n");
}

function severityWeight(severity: "low" | "medium" | "high"): number {
  if (severity === "high") {
    return 3;
  }
  if (severity === "medium") {
    return 2;
  }
  return 1;
}

function buildLocalGuidance(
  prompt: string,
  analysis: RepositoryAnalysisResult,
): string {
  const rankedIssues = [...analysis.issues]
    .sort((left, right) => {
      const severityDelta =
        severityWeight(right.severity) - severityWeight(left.severity);
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return right.confidenceScore - left.confidenceScore;
    })
    .slice(0, 5);

  const lines = [
    "Local analysis guidance (AI provider unavailable)",
    "",
    `Performance score: ${analysis.performance.score} (${analysis.performance.riskLevel.toUpperCase()} risk)`,
    `Files analyzed: ${analysis.fileCount}`,
    `Findings: ${analysis.issues.length}`,
    "",
  ];

  if (rankedIssues.length === 0) {
    lines.push("No actionable findings were detected in this scan.");
    return lines.join("\n");
  }

  lines.push("Top priorities:");
  rankedIssues.forEach((issue, index) => {
    lines.push(
      `${index + 1}. [${issue.severity.toUpperCase()}] ${issue.message} (${issue.file} -> ${issue.function})`,
    );
  });

  lines.push("");

  if (/fix|resolve|improve|optimi|recommend|what should/i.test(prompt)) {
    lines.push("Suggested next steps:");
    lines.push(
      "1. Address HIGH severity findings first, then MEDIUM findings.",
    );
    lines.push(
      "2. Add targeted tests around affected files/functions before refactoring.",
    );
    lines.push(
      "3. Re-run analysis after each batch of fixes and compare issue count/score.",
    );
  } else {
    lines.push(
      "Ask for a fix plan, refactor strategy, or test checklist for any specific finding above.",
    );
  }

  return lines.join("\n");
}

function buildIssuePayload(issue: IssueData): IssueData {
  // Keep only structured metadata; never include raw source code in AI prompt.
  return {
    type: issue.type,
    severity: issue.severity,
    file: issue.file,
    function: issue.function,
    message: issue.message,
    confidenceScore: issue.confidenceScore,
    ...(issue.source ? { source: issue.source } : {}),
    ...(issue.rule ? { rule: issue.rule } : {}),
    ...(issue.code ? { code: issue.code } : {}),
  };
}

function buildFallbackIssueExplanation(
  issue: IssueData,
): IssueExplanationOutput {
  const explanation =
    issue.type === "PERFORMANCE"
      ? `The issue indicates a performance hotspot in ${issue.function}.`
      : issue.type === "BUG"
        ? `The issue suggests a functional defect risk in ${issue.function}.`
        : `The issue highlights an operational or reliability risk in ${issue.function}.`;

  const impact =
    issue.severity === "high"
      ? "High impact: can significantly affect reliability, latency, or correctness."
      : issue.severity === "medium"
        ? "Medium impact: may cause degraded behavior under load or edge cases."
        : "Low impact: limited immediate effect but worth addressing to prevent drift.";

  const fixSuggestion =
    issue.type === "PERFORMANCE"
      ? "Refactor heavy paths, reduce repeated calls, and add batching/caching where possible."
      : issue.type === "BUG"
        ? "Add defensive checks, improve branch coverage, and introduce focused regression tests."
        : "Add robust error handling, clearer guards, and monitoring around the affected flow.";

  return {
    explanation,
    impact,
    fixSuggestion,
  };
}

function parseIssueExplanationResponse(
  content: string,
): IssueExplanationOutput | null {
  const parseCandidate = (candidate: string): IssueExplanationOutput | null => {
    try {
      const parsed = JSON.parse(candidate) as Partial<IssueExplanationOutput>;
      if (
        typeof parsed.explanation === "string" &&
        typeof parsed.impact === "string" &&
        typeof parsed.fixSuggestion === "string"
      ) {
        return {
          explanation: parsed.explanation,
          impact: parsed.impact,
          fixSuggestion: parsed.fixSuggestion,
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  const direct = parseCandidate(content);
  if (direct) {
    return direct;
  }

  const jsonBlock = content.match(/\{[\s\S]*\}/);
  if (!jsonBlock) {
    return null;
  }

  return parseCandidate(jsonBlock[0]);
}

export async function generateIssueExplanation(
  input: IssueExplanationInput,
): Promise<IssueExplanationOutput> {
  const safeIssuePayload = buildIssuePayload(input.issue);

  if (!process.env.GROQ_API_KEY) {
    return buildFallbackIssueExplanation(input.issue);
  }

  const systemPrompt =
    "You are a senior code-analysis assistant. Produce concise, actionable guidance. Never ask for or reconstruct raw source code.";
  const modelPrompt = [
    "Explain this static-analysis issue using only the structured metadata below.",
    "Return strict JSON with keys: explanation, impact, fixSuggestion.",
    "Issue:",
    JSON.stringify(safeIssuePayload, null, 2),
  ].join("\n\n");

  try {
    const client = new GroqClient();
    const rawContent = await client.completeChat(modelPrompt, systemPrompt);
    const parsed = parseIssueExplanationResponse(rawContent);

    return parsed ?? buildFallbackIssueExplanation(input.issue);
  } catch {
    return buildFallbackIssueExplanation(input.issue);
  }
}

export function buildIssueExplanationText(
  explanation: IssueExplanationOutput,
): string {
  return [
    `Explanation: ${explanation.explanation}`,
    `Impact: ${explanation.impact}`,
    `Fix suggestion: ${explanation.fixSuggestion}`,
  ].join("\n");
}

export async function generateExplanation(
  input: IssueExplanationInput,
): Promise<IssueExplanationOutput>;
export async function generateExplanation(
  input: LegacyExplanationInput,
): Promise<string>;
export async function generateExplanation(
  input: LegacyExplanationInput | IssueExplanationInput,
): Promise<string | IssueExplanationOutput> {
  if ("issue" in input) {
    return generateIssueExplanation(input);
  }

  const summary = buildSummary(input.analysis);
  const systemPrompt =
    "You are a senior static-analysis engineer. Provide concise, actionable explanations and recommendations.";
  const modelPrompt = `${summary}\n\nUser question: ${input.prompt}`;

  if (!process.env.GROQ_API_KEY) {
    return buildLocalGuidance(input.prompt, input.analysis);
  }

  try {
    const client = new GroqClient();
    return await client.completeChat(modelPrompt, systemPrompt);
  } catch {
    return buildLocalGuidance(input.prompt, input.analysis);
  }
}

import type { RepositoryAnalysisResult } from "@/core";

import { GroqClient } from "./groqClient";

export interface ExplanationInput {
  prompt: string;
  analysis: RepositoryAnalysisResult;
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

export async function generateExplanation(
  input: ExplanationInput,
): Promise<string> {
  const summary = buildSummary(input.analysis);
  const systemPrompt =
    "You are a senior static-analysis engineer. Provide concise, actionable explanations and recommendations.";
  const modelPrompt = `${summary}\n\nUser question: ${input.prompt}`;

  if (!process.env.GROQ_API_KEY) {
    return `${summary}\n\nNo GROQ_API_KEY detected. Returning local summary only.`;
  }

  const client = new GroqClient();
  return client.completeChat(modelPrompt, systemPrompt);
}

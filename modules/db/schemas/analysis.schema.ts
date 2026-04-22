import type { RepositoryAnalysisResult } from "@/core";

export interface AnalysisRecord {
  id: string;
  repositoryId: string;
  createdAt: string;
  result: RepositoryAnalysisResult;
}

export function createAnalysisRecord(
  input: Omit<AnalysisRecord, "id" | "createdAt">,
): AnalysisRecord {
  return {
    id: crypto.randomUUID(),
    repositoryId: input.repositoryId,
    createdAt: new Date().toISOString(),
    result: input.result,
  };
}

import type {
  AnalyzeRepositoryOptions,
  RepositoryAnalysisResult,
} from "@/core";

export interface AnalyzeRequestBody {
  repoUrl: string;
  cloneTargetDirectory?: string;
  cloneBranch?: string;
  cloneDepth?: number;
  existingFolderStrategy?: "reuse" | "clean" | "error";
  options?: AnalyzeRepositoryOptions;
}

export type AnalyzeResponseBody = RepositoryAnalysisResult;

export interface ChatRequestBody {
  prompt: string;
  analysis: RepositoryAnalysisResult;
}

export interface ChatResponseBody {
  content: string;
}

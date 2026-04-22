import type {
  AnalyzeRepositoryOptions,
  RepositoryAnalysisResult,
  SourceFileInput,
} from "@/core";

export interface AnalyzeRequestBody {
  repositoryPath?: string;
  files?: SourceFileInput[];
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

import { analyzePerformance, traceFlow } from "@/core/analyzer";
import { buildAnalysisGraph } from "@/core/graph";
import type { CodeRepositoryIR, IRNode, SourceFileInput } from "@/core/ir";
import { convertSyntaxTreeToIR, parseSourceToSyntaxTree } from "@/core/parser";
import {
  DEFAULT_MAX_FILES,
  DEFAULT_TRACE_DEPTH,
  SUPPORTED_SOURCE_EXTENSIONS,
} from "@/utils";

export interface AnalyzeRepositoryOptions {
  maxFiles?: number;
  includeExtensions?: string[];
  traceFromNodeId?: string;
  traceDepth?: number;
}

export interface RepositoryAnalysisResult {
  analyzedAt: string;
  fileCount: number;
  irStats: {
    totalNodes: number;
    functionCount: number;
    apiCallCount: number;
    tryCatchCount: number;
  };
  graphStats: {
    totalNodes: number;
    totalEdges: number;
  };
  findings: ReturnType<typeof analyzePerformance>["findings"];
  performance: ReturnType<typeof analyzePerformance>["performance"];
  traces: ReturnType<typeof traceFlow>[];
}

function collectIrStats(nodes: IRNode[]): RepositoryAnalysisResult["irStats"] {
  return {
    totalNodes: nodes.length,
    functionCount: nodes.filter((node) => node.kind === "function").length,
    apiCallCount: nodes.filter((node) => node.kind === "api-call").length,
    tryCatchCount: nodes.filter((node) => node.kind === "try-catch").length,
  };
}

function normalizeFiles(
  files: SourceFileInput[],
  options?: AnalyzeRepositoryOptions,
): SourceFileInput[] {
  const allowedExtensions = new Set(
    (options?.includeExtensions?.length
      ? options.includeExtensions
      : [...SUPPORTED_SOURCE_EXTENSIONS]
    ).map((ext) => ext.toLowerCase()),
  );

  const filtered = files.filter((file) => {
    const extension = file.path.slice(file.path.lastIndexOf(".")).toLowerCase();
    return allowedExtensions.has(extension);
  });

  return filtered.slice(0, options?.maxFiles ?? DEFAULT_MAX_FILES);
}

export async function analyzeRepository(input: {
  files: SourceFileInput[];
  options?: AnalyzeRepositoryOptions;
}): Promise<RepositoryAnalysisResult> {
  const normalizedFiles = normalizeFiles(input.files, input.options);
  const parseResults = normalizedFiles.map((file) =>
    parseSourceToSyntaxTree(file),
  );
  const irFiles = parseResults.map((result) => convertSyntaxTreeToIR(result));

  const repositoryIR: CodeRepositoryIR = {
    files: irFiles,
  };

  const graph = buildAnalysisGraph(repositoryIR);
  const analyzed = analyzePerformance(graph);

  const allIrNodes = irFiles.flatMap((file) => file.nodes);
  const traces = input.options?.traceFromNodeId
    ? [
        traceFlow(
          graph,
          input.options.traceFromNodeId,
          input.options.traceDepth ?? DEFAULT_TRACE_DEPTH,
        ),
      ]
    : [];

  return {
    analyzedAt: new Date().toISOString(),
    fileCount: normalizedFiles.length,
    irStats: collectIrStats(allIrNodes),
    graphStats: {
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
    },
    findings: analyzed.findings,
    performance: analyzed.performance,
    traces,
  };
}

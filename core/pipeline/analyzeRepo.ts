import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

import { analyzePerformance, traceFlow } from "@/core/analyzer";
import { buildAnalysisGraph } from "@/core/graph";
import type { GraphEdge, GraphNode } from "@/core/graph";
import type {
  CodeRepositoryIR,
  IRFile,
  IRNode,
  SourceFileInput,
} from "@/core/ir";
import { convertAstToIR } from "@/core/parser";
import { runRuleEngine } from "@/core/rules";
import type { RuleIssue } from "@/core/rules";
import { cloneRepository, scanRepositoryFiles } from "@/modules/repo";
import type { ExistingFolderStrategy } from "@/modules/repo";
import { DEFAULT_TRACE_DEPTH } from "@/utils";

const DEFAULT_CLONE_ROOT = process.env.VERCEL
  ? path.join(os.tmpdir(), "kireicode-cache", "repos")
  : path.resolve(process.cwd(), ".analysis-cache", "repos");

function toDefaultCloneTargetDirectory(repositoryUrl: string): string {
  const hash = createHash("sha1")
    .update(repositoryUrl)
    .digest("hex")
    .slice(0, 16);
  return path.join(DEFAULT_CLONE_ROOT, hash);
}

export interface AnalyzeRepositoryOptions {
  maxFiles?: number;
  includeExtensions?: string[];
  traceFromNodeId?: string;
  traceDepth?: number;
}

export interface AnalyzeRepositoryInput {
  repositoryUrl?: string;
  repositoryPath?: string;
  cloneTargetDirectory?: string;
  cloneBranch?: string;
  cloneDepth?: number;
  existingFolderStrategy?: ExistingFolderStrategy;
  files?: SourceFileInput[];
  options?: AnalyzeRepositoryOptions;
}

export interface AnalysisIssue {
  source: "RULE_ENGINE" | "PERFORMANCE_ANALYZER";
  type: "PERFORMANCE" | "BUG" | "RISK";
  severity: "low" | "medium" | "high";
  file: string;
  function: string;
  message: string;
  confidenceScore: number;
  rule?: string;
  code?: string;
}

export interface IRSummary {
  totalFiles: number;
  parsedFiles: number;
  failedFiles: number;
  totalNodes: number;
  totalFunctions: number;
  totalDependencies: number;
  totalFunctionCalls: number;
}

export interface GraphSummary {
  totalNodes: number;
  totalEdges: number;
  fileNodes: number;
  functionNodes: number;
  importEdges: number;
  callEdges: number;
}

export interface RepositoryAnalysisResult {
  analyzedAt: string;
  fileCount: number;
  irSummary: IRSummary;
  graphSummary: GraphSummary;

  issues: AnalysisIssue[];

  graphData: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };

  // Compatibility fields kept for existing consumers.
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
  findings: AnalysisIssue[];
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

function buildRepositoryIR(irFiles: IRFile[]): CodeRepositoryIR {
  return {
    files: irFiles,
    functions: irFiles.flatMap((file) => file.functions ?? []),
    dependencies: irFiles.flatMap((file) => file.dependencies ?? []),
  };
}

function collectIrSummary(
  irFiles: IRFile[],
  parsedFiles: number,
  failedFiles: number,
): IRSummary {
  const allNodes = irFiles.flatMap((file) => file.nodes);
  const allFunctions = irFiles.flatMap((file) => file.functions ?? []);
  const allDependencies = irFiles.flatMap((file) => file.dependencies ?? []);

  return {
    totalFiles: irFiles.length,
    parsedFiles,
    failedFiles,
    totalNodes: allNodes.length,
    totalFunctions: allFunctions.length,
    totalDependencies: allDependencies.length,
    totalFunctionCalls: allFunctions.reduce(
      (count, fn) => count + fn.functionCalls.length,
      0,
    ),
  };
}

function collectGraphSummary(
  graph: ReturnType<typeof buildAnalysisGraph>,
): GraphSummary {
  return {
    totalNodes: graph.nodes.length,
    totalEdges: graph.edges.length,
    fileNodes: graph.nodes.filter((node) => node.type === "file").length,
    functionNodes: graph.nodes.filter((node) => node.type === "function")
      .length,
    importEdges: graph.edges.filter((edge) => edge.type === "IMPORT").length,
    callEdges: graph.edges.filter(
      (edge) => edge.type === "CALL" || edge.type === "calls",
    ).length,
  };
}

function mergeIssues(
  ruleIssues: RuleIssue[],
  performanceIssues: ReturnType<typeof analyzePerformance>["issues"],
): AnalysisIssue[] {
  const merged: AnalysisIssue[] = [
    ...ruleIssues.map((issue) => ({
      source: "RULE_ENGINE" as const,
      type: issue.type,
      severity: issue.severity,
      file: issue.file,
      function: issue.function,
      message: issue.message,
      confidenceScore: issue.confidenceScore,
      rule: issue.rule,
    })),
    ...performanceIssues.map((issue) => ({
      source: "PERFORMANCE_ANALYZER" as const,
      type: issue.type,
      severity: issue.severity,
      file: issue.file,
      function: issue.function,
      message: issue.message,
      confidenceScore: issue.confidenceScore,
      code: issue.code,
    })),
  ];

  const deduped = new Map<string, AnalysisIssue>();
  merged.forEach((issue) => {
    const key = `${issue.source}:${issue.file}:${issue.function}:${issue.message}`;
    if (!deduped.has(key)) {
      deduped.set(key, issue);
    }
  });

  return [...deduped.values()];
}

async function resolveSourceFiles(
  input: AnalyzeRepositoryInput,
): Promise<SourceFileInput[]> {
  if (input.files?.length) {
    return input.files;
  }

  let localRepositoryPath = input.repositoryPath;

  // Step 1: Clone repository locally when URL is provided.
  if (!localRepositoryPath && input.repositoryUrl) {
    const cloneTargetDirectory =
      input.cloneTargetDirectory ??
      toDefaultCloneTargetDirectory(input.repositoryUrl);

    localRepositoryPath = await cloneRepository({
      repositoryUrl: input.repositoryUrl,
      targetDirectory: cloneTargetDirectory,
      ...(input.cloneBranch ? { branch: input.cloneBranch } : {}),
      ...(typeof input.cloneDepth === "number"
        ? { depth: input.cloneDepth }
        : {}),
      ...(input.existingFolderStrategy
        ? { existingFolderStrategy: input.existingFolderStrategy }
        : {}),
    });
  }

  if (!localRepositoryPath) {
    throw new Error("Provide either files, repositoryPath, or repositoryUrl.");
  }

  // Step 2: Scan repository files.
  return scanRepositoryFiles(localRepositoryPath, input.options);
}

export async function analyzeRepository(
  input: AnalyzeRepositoryInput,
): Promise<RepositoryAnalysisResult> {
  const sourceFiles = await resolveSourceFiles(input);

  // Step 3 + 4: Parse source into AST and convert to IR.
  const irFiles = sourceFiles.map((file) =>
    convertAstToIR(file.content, file.path),
  );

  const parsedFiles = sourceFiles.reduce((count, sourceFile, index) => {
    const irFile = irFiles[index];
    if (!irFile) {
      return count;
    }

    const hasExtractedData =
      irFile.nodes.length > 0 ||
      (irFile.functions?.length ?? 0) > 0 ||
      (irFile.dependencies?.length ?? 0) > 0;

    // Empty files are valid parse targets and should not count as failures.
    const isEmptySource = sourceFile.content.trim().length === 0;

    return count + (hasExtractedData || isEmptySource ? 1 : 0);
  }, 0);

  const failedFiles = sourceFiles.length - parsedFiles;

  const repositoryIR = buildRepositoryIR(irFiles);

  // Step 5: Build graph from IR.
  const graph = buildAnalysisGraph(repositoryIR);

  // Step 6: Run rule engine on IR.
  const ruleIssues = runRuleEngine(repositoryIR);

  // Step 7: Run performance analyzer on graph.
  const analyzed = analyzePerformance(graph);
  const issues = mergeIssues(ruleIssues, analyzed.issues);

  const allIrNodes = irFiles.flatMap((file) => file.nodes);
  const irSummary = collectIrSummary(irFiles, parsedFiles, failedFiles);
  const graphSummary = collectGraphSummary(graph);

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
    fileCount: sourceFiles.length,
    irSummary,
    graphSummary,
    issues,
    graphData: {
      nodes: graph.nodes,
      edges: graph.edges,
    },
    irStats: collectIrStats(allIrNodes),
    graphStats: {
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
    },
    findings: issues,
    performance: analyzed.performance,
    traces,
  };
}

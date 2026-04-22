import path from "node:path";

import { Graph } from "graphlib";

import type {
  CodeRepositoryIR,
  IRDependency,
  IRFile,
  IRFunction,
} from "@/core/ir";

import type { AnalysisGraph, GraphEdge, GraphNode } from "./graphTypes";

const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
] as const;

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function toFileNodeId(filePath: string): string {
  return `file:${normalizePath(filePath)}`;
}

function toFunctionNodeId(functionId: string): string {
  return `function:${functionId}`;
}

function collectFunctions(file: IRFile): IRFunction[] {
  if (file.functions?.length) {
    return file.functions;
  }

  // Compatibility path for legacy IR where function data lived in generic nodes.
  return file.nodes
    .filter((node) => node.kind === "function")
    .map((node) => {
      const isAsync =
        node.metadata.async === true || node.metadata.async === "true";
      const complexityRaw = node.metadata.complexity;
      const complexityScore =
        typeof complexityRaw === "number" ? complexityRaw : 1;

      return {
        id: node.id,
        name: node.name,
        filePath: file.filePath,
        functionCalls: [],
        isAsync,
        hasTryCatch: false,
        complexityScore,
        location: node.location,
      };
    });
}

function buildFileResolutionIndex(
  repositoryIR: CodeRepositoryIR,
): Map<string, string> {
  const lookup = new Map<string, string>();

  repositoryIR.files.forEach((file) => {
    const normalizedPath = normalizePath(file.filePath);
    lookup.set(normalizedPath, file.filePath);

    const extension = path.extname(normalizedPath);
    if (extension) {
      const extensionless = normalizedPath.slice(0, -extension.length);
      lookup.set(extensionless, file.filePath);

      const indexSuffix = `/index${extension}`;
      if (normalizedPath.endsWith(indexSuffix)) {
        const parentPath = normalizedPath.slice(0, -indexSuffix.length);
        lookup.set(parentPath, file.filePath);
      }
    }
  });

  return lookup;
}

function resolveDependencyTarget(
  dependency: IRDependency,
  sourceFilePath: string,
  fileLookup: Map<string, string>,
): string | null {
  if (dependency.isExternal) {
    return null;
  }

  const rawTarget = normalizePath(dependency.target);
  const baseTarget =
    rawTarget.startsWith(".") || rawTarget.startsWith("..")
      ? normalizePath(path.join(path.dirname(sourceFilePath), rawTarget))
      : rawTarget;

  const candidates = new Set<string>([baseTarget]);

  SOURCE_EXTENSIONS.forEach((extension) => {
    candidates.add(`${baseTarget}${extension}`);
    candidates.add(`${baseTarget}/index${extension}`);
  });

  for (const candidate of candidates) {
    const resolved = fileLookup.get(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function addNode(
  directedGraph: Graph,
  nodes: GraphNode[],
  node: GraphNode,
): void {
  if (directedGraph.hasNode(node.id)) {
    return;
  }

  directedGraph.setNode(node.id, node);
  nodes.push(node);
}

function addEdge(
  directedGraph: Graph,
  edges: GraphEdge[],
  edge: GraphEdge,
  edgeName: string,
): void {
  if (directedGraph.hasEdge(edge.from, edge.to, edgeName)) {
    return;
  }

  directedGraph.setEdge(edge.from, edge.to, edge, edgeName);
  edges.push(edge);
}

export function buildAnalysisGraph(
  repositoryIR: CodeRepositoryIR,
): AnalysisGraph {
  const directedGraph = new Graph({ directed: true, multigraph: true });
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const fileLookup = buildFileResolutionIndex(repositoryIR);
  const fileNodeIdByPath = new Map<string, string>();
  const functionsById = new Map<string, IRFunction>();
  const functionNodeIdByFunctionId = new Map<string, string>();
  const functionsByName = new Map<string, IRFunction[]>();
  const functionsByFileAndName = new Map<string, IRFunction>();

  repositoryIR.files.forEach((file) => {
    const fileNodeId = toFileNodeId(file.filePath);
    fileNodeIdByPath.set(file.filePath, fileNodeId);

    addNode(directedGraph, nodes, {
      id: fileNodeId,
      filePath: file.filePath,
      type: "file",
      label: file.filePath,
      metadata: {
        language: file.language,
      },
    });

    collectFunctions(file).forEach((fn) => {
      const functionNodeId = toFunctionNodeId(fn.id);

      functionsById.set(fn.id, fn);
      functionNodeIdByFunctionId.set(fn.id, functionNodeId);
      functionsByFileAndName.set(
        `${normalizePath(fn.filePath)}::${fn.name}`,
        fn,
      );

      const sameNameFunctions = functionsByName.get(fn.name) ?? [];
      sameNameFunctions.push(fn);
      functionsByName.set(fn.name, sameNameFunctions);

      addNode(directedGraph, nodes, {
        id: functionNodeId,
        filePath: fn.filePath,
        type: "function",
        label: fn.name,
        location: fn.location,
        metadata: {
          async: fn.isAsync,
          hasTryCatch: fn.hasTryCatch,
          complexity: fn.complexityScore,
        },
      });
    });
  });

  repositoryIR.files.forEach((file) => {
    const sourceFileNodeId = fileNodeIdByPath.get(file.filePath);
    if (!sourceFileNodeId) {
      return;
    }

    (file.dependencies ?? []).forEach((dependency) => {
      const targetPath = resolveDependencyTarget(
        dependency,
        file.filePath,
        fileLookup,
      );
      if (!targetPath) {
        return;
      }

      const targetFileNodeId = fileNodeIdByPath.get(targetPath);
      if (!targetFileNodeId) {
        return;
      }

      addEdge(
        directedGraph,
        edges,
        {
          from: sourceFileNodeId,
          to: targetFileNodeId,
          type: "IMPORT",
          layer: "CORE",
          metadata: {
            dependencyKind: dependency.kind,
            external: dependency.isExternal,
          },
        },
        `IMPORT:${dependency.id}`,
      );
    });

    collectFunctions(file).forEach((fn) => {
      const sourceFunctionNodeId = functionNodeIdByFunctionId.get(fn.id);
      if (!sourceFunctionNodeId) {
        return;
      }

      fn.functionCalls.forEach((call, index) => {
        let targetFunction: IRFunction | undefined;

        if (call.calleeId) {
          targetFunction = functionsById.get(call.calleeId);
        }

        if (!targetFunction) {
          targetFunction = functionsByFileAndName.get(
            `${normalizePath(file.filePath)}::${call.calleeName}`,
          );
        }

        if (!targetFunction) {
          const sameNameFunctions = functionsByName.get(call.calleeName) ?? [];
          if (sameNameFunctions.length === 1) {
            targetFunction = sameNameFunctions[0];
          }
        }

        if (!targetFunction) {
          return;
        }

        const targetFunctionNodeId = functionNodeIdByFunctionId.get(
          targetFunction.id,
        );
        if (!targetFunctionNodeId) {
          return;
        }

        addEdge(
          directedGraph,
          edges,
          {
            from: sourceFunctionNodeId,
            to: targetFunctionNodeId,
            type: "CALL",
            layer: "CORE",
            metadata: {
              callSite: index,
            },
          },
          `CALL:${fn.id}:${index}:${targetFunction.id}`,
        );
      });
    });
  });

  return {
    nodes,
    edges,
    directedGraph,
    layers: {
      apiFlowEnabled: false,
      dbAccessEnabled: false,
    },
  };
}

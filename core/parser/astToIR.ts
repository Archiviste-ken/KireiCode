import type Parser from "tree-sitter";

import type {
  IRDependency,
  IRFile,
  IRFunction,
  IRFunctionCall,
  IRNode,
  SourceLocation,
} from "@/core/ir";

import { detectLanguage, parseCode } from "./treeSitter";
import type { ParseResult, SyntaxNode } from "./treeSitter";

export interface FileNode extends IRFile {
  functions: IRFunction[];
  dependencies: IRDependency[];
}

const FUNCTION_NODE_TYPES = [
  "function_declaration",
  "function_expression",
  "arrow_function",
] as const;

const COMPLEXITY_NODE_TYPES = [
  "if_statement",
  "for_statement",
  "for_in_statement",
  "while_statement",
  "do_statement",
  "switch_case",
  "conditional_expression",
  "catch_clause",
  "logical_expression",
] as const;

function toLocation(node: Parser.SyntaxNode): SourceLocation {
  return {
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
  };
}

function unquote(value: string): string {
  const first = value[0];
  const last = value[value.length - 1];
  if (
    value.length >= 2 &&
    ((first === '"' && last === '"') ||
      (first === "'" && last === "'") ||
      (first === "`" && last === "`"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function isExternalTarget(target: string): boolean {
  return !target.startsWith(".") && !target.startsWith("/");
}

function resolveFunctionName(node: Parser.SyntaxNode): string {
  const directName = node.childForFieldName("name")?.text;
  if (directName) {
    return directName;
  }

  if (node.parent?.type === "variable_declarator") {
    const variableName = node.parent.childForFieldName("name")?.text;
    if (variableName) {
      return variableName;
    }
  }

  if (node.parent?.type === "assignment_expression") {
    const assignmentLeft = node.parent.childForFieldName("left")?.text;
    if (assignmentLeft) {
      return assignmentLeft;
    }
  }

  return "anonymous";
}

function isAsyncFunction(node: Parser.SyntaxNode): boolean {
  // Simple AST check: if a child token is "async", this function is async.
  for (let index = 0; index < node.childCount; index += 1) {
    if (node.child(index)?.type === "async") {
      return true;
    }
  }

  return false;
}

function hasTryCatch(node: Parser.SyntaxNode): boolean {
  // We count try/catch only when both are present in the same function body.
  return node.descendantsOfType("try_statement").some((tryNode) => {
    return tryNode.descendantsOfType("catch_clause").length > 0;
  });
}

function collectFunctionCalls(node: Parser.SyntaxNode): IRFunctionCall[] {
  return node.descendantsOfType("call_expression").map((callNode) => {
    const callee = callNode.childForFieldName("function")?.text ?? "unknown";
    return {
      calleeName: callee,
      location: toLocation(callNode),
    };
  });
}

function computeComplexityScore(node: Parser.SyntaxNode): number {
  // Baseline complexity starts at 1, then increments per branching construct.
  return 1 + node.descendantsOfType([...COMPLEXITY_NODE_TYPES]).length;
}

function collectImportSymbols(importNode: Parser.SyntaxNode): string[] {
  const symbols = new Set<string>();

  importNode.namedChildren.forEach((child) => {
    if (child.type === "string") {
      return;
    }

    if (child.type === "identifier") {
      symbols.add(child.text);
      return;
    }

    child.descendantsOfType("identifier").forEach((identifierNode) => {
      symbols.add(identifierNode.text);
    });
  });

  return [...symbols];
}

function collectDependencies(
  rootNode: Parser.SyntaxNode,
  filePath: string,
): IRDependency[] {
  const dependencies: IRDependency[] = [];

  rootNode.descendantsOfType("import_statement").forEach((importNode) => {
    const sourceNode =
      importNode.childForFieldName("source") ?? importNode.namedChildren.at(-1);
    if (!sourceNode) {
      return;
    }

    const target = unquote(sourceNode.text);
    dependencies.push({
      id: `${filePath}:import:${importNode.startIndex}`,
      sourceFilePath: filePath,
      target,
      kind: "import",
      isExternal: isExternalTarget(target),
      importedSymbols: collectImportSymbols(importNode),
    });
  });

  rootNode.descendantsOfType("call_expression").forEach((callNode) => {
    const callee = callNode.childForFieldName("function")?.text;
    const firstArgumentNode = callNode
      .childForFieldName("arguments")
      ?.namedChild(0);
    if (!firstArgumentNode || firstArgumentNode.type !== "string") {
      return;
    }

    const target = unquote(firstArgumentNode.text);

    if (callee === "require") {
      dependencies.push({
        id: `${filePath}:require:${callNode.startIndex}`,
        sourceFilePath: filePath,
        target,
        kind: "require",
        isExternal: isExternalTarget(target),
        importedSymbols: ["default"],
      });
      return;
    }

    if (callee === "import") {
      dependencies.push({
        id: `${filePath}:dynamic-import:${callNode.startIndex}`,
        sourceFilePath: filePath,
        target,
        kind: "dynamic-import",
        isExternal: isExternalTarget(target),
        importedSymbols: ["default"],
      });
    }
  });

  return dependencies;
}

function collectFunctions(
  rootNode: Parser.SyntaxNode,
  filePath: string,
): IRFunction[] {
  return rootNode
    .descendantsOfType([...FUNCTION_NODE_TYPES])
    .map((functionNode) => ({
      id: `${filePath}:fn:${functionNode.startIndex}`,
      name: resolveFunctionName(functionNode),
      filePath,
      functionCalls: collectFunctionCalls(functionNode),
      isAsync: isAsyncFunction(functionNode),
      hasTryCatch: hasTryCatch(functionNode),
      complexityScore: computeComplexityScore(functionNode),
      location: toLocation(functionNode),
    }));
}

function toLegacyNodes(fileNode: FileNode): IRNode[] {
  const nodes: IRNode[] = [];

  fileNode.functions.forEach((fn) => {
    const functionLocation = fn.location ?? { startLine: 1, endLine: 1 };
    nodes.push({
      id: fn.id,
      kind: "function",
      name: fn.name,
      location: functionLocation,
      metadata: {
        filePath: fn.filePath,
        async: fn.isAsync,
        complexity: fn.complexityScore,
      },
    });

    fn.functionCalls.forEach((call, index) => {
      const callLocation = call.location ?? functionLocation;
      nodes.push({
        id: `${fn.id}:call:${index}`,
        kind: "api-call",
        name: call.calleeName,
        location: callLocation,
        metadata: {
          endpoint: call.calleeName,
          filePath: fn.filePath,
        },
        parentId: fn.id,
      });
    });

    if (fn.hasTryCatch) {
      nodes.push({
        id: `${fn.id}:tc`,
        kind: "try-catch",
        name: `try-catch:${fn.name}`,
        location: functionLocation,
        metadata: {
          guarded: true,
          filePath: fn.filePath,
        },
        parentId: fn.id,
      });
    }
  });

  return nodes;
}

export function convertAstToIR(code: string, filePath: string): FileNode {
  const language = detectLanguage(filePath);
  const rootNode = parseCode(code);

  if (!rootNode) {
    return {
      filePath,
      language,
      functions: [],
      dependencies: [],
      nodes: [],
    };
  }

  const functions = collectFunctions(rootNode, filePath);
  const dependencies = collectDependencies(rootNode, filePath);

  const fileNode: FileNode = {
    filePath,
    language,
    functions,
    dependencies,
    nodes: [],
  };

  fileNode.nodes = toLegacyNodes(fileNode);
  return fileNode;
}

function walkNode(
  node: SyntaxNode,
  filePath: string,
  output: IRNode[],
  parentId?: string,
): void {
  const irNode: IRNode = {
    id: node.id,
    kind: node.kind,
    name: node.name,
    location: {
      startLine: node.startLine,
      endLine: node.endLine,
    },
    metadata: {
      ...node.metadata,
      filePath,
    },
  };

  if (parentId) {
    irNode.parentId = parentId;
  }

  output.push(irNode);

  node.children.forEach((child) => {
    walkNode(child, filePath, output, node.id);
  });
}

// Backward-compatible conversion path used by the existing pipeline.
export function convertSyntaxTreeToIR(parseResult: ParseResult): IRFile {
  const nodes: IRNode[] = [];

  parseResult.nodes.forEach((node) => {
    walkNode(node, parseResult.filePath, nodes);
  });

  return {
    filePath: parseResult.filePath,
    language: parseResult.language,
    nodes,
  };
}

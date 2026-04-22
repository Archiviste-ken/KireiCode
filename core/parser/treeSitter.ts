import path from "node:path";
import { createRequire } from "node:module";
import type Parser from "tree-sitter";

import type { SourceFileInput, SupportedLanguage } from "@/core/ir";
import { FILE_EXTENSION_LANGUAGE_MAP } from "@/utils";

export interface SyntaxNode {
  id: string;
  kind: "function" | "api-call" | "try-catch";
  name: string;
  startLine: number;
  endLine: number;
  metadata: Record<string, string | number | boolean>;
  children: SyntaxNode[];
}

export interface ParseResult {
  filePath: string;
  language: SupportedLanguage;
  nodes: SyntaxNode[];
}

const require = createRequire(import.meta.url);

type RuntimeParser = {
  parse(input: string): { rootNode: Parser.SyntaxNode };
  setLanguage(language: unknown): void;
};

let runtimeParser: RuntimeParser | null | undefined;

function getRuntimeParser(): RuntimeParser | null {
  if (runtimeParser !== undefined) {
    return runtimeParser;
  }

  try {
    const TreeSitter = require("tree-sitter") as {
      new (): RuntimeParser;
    };
    const JavaScript = require("tree-sitter-javascript") as unknown;
    const parser = new TreeSitter();
    parser.setLanguage(JavaScript);
    runtimeParser = parser;
  } catch {
    runtimeParser = null;
  }

  return runtimeParser;
}

const FUNCTION_NODE_TYPES = [
  "function_declaration",
  "function_expression",
  "arrow_function",
] as const;

const API_CALLEES = new Set([
  "fetch",
  "axios.get",
  "axios.post",
  "axios.put",
  "axios.patch",
  "axios.delete",
  "client.get",
  "client.post",
  "client.put",
  "client.patch",
  "client.delete",
]);

function toLine(position: Parser.Point): number {
  return position.row + 1;
}

function unwrapQuotedValue(value: string): string | null {
  const match = value.match(/^(["'`])(.*)\1$/s);
  return match?.[2] ?? null;
}

function resolveFunctionName(node: Parser.SyntaxNode): string {
  const directName = node.childForFieldName("name")?.text;
  if (directName) {
    return directName;
  }

  const parentName =
    node.parent?.type === "variable_declarator"
      ? node.parent.childForFieldName("name")?.text
      : undefined;

  return parentName ?? "anonymous";
}

function toApiChildren(
  filePath: string,
  functionNode: Parser.SyntaxNode,
): SyntaxNode[] {
  return functionNode
    .descendantsOfType("call_expression")
    .flatMap((callNode) => {
      const callee = callNode.childForFieldName("function")?.text;
      if (!callee || !API_CALLEES.has(callee)) {
        return [];
      }

      const rawArgument = callNode
        .childForFieldName("arguments")
        ?.namedChild(0)?.text;
      const endpoint = rawArgument ? unwrapQuotedValue(rawArgument) : null;

      return [
        {
          id: `${filePath}:api:${callNode.startIndex}`,
          kind: "api-call" as const,
          name: endpoint ?? callee,
          startLine: toLine(callNode.startPosition),
          endLine: toLine(callNode.endPosition),
          metadata: {
            endpoint: endpoint ?? callee,
          },
          children: [],
        },
      ];
    });
}

function toTryCatchChildren(
  filePath: string,
  functionNode: Parser.SyntaxNode,
): SyntaxNode[] {
  const hasTryStatement =
    functionNode.descendantsOfType("try_statement").length > 0;
  const hasCatchClause =
    functionNode.descendantsOfType("catch_clause").length > 0;

  if (!hasTryStatement || !hasCatchClause) {
    return [];
  }

  return [
    {
      id: `${filePath}:tc:${functionNode.startIndex}`,
      kind: "try-catch",
      name: `try-catch:${resolveFunctionName(functionNode)}`,
      startLine: toLine(functionNode.startPosition),
      endLine: toLine(functionNode.endPosition),
      metadata: {
        guarded: true,
      },
      children: [],
    },
  ];
}

export function parseCode(code: string): Parser.SyntaxNode | null {
  const parser = getRuntimeParser();
  if (!parser) {
    return null;
  }

  try {
    return parser.parse(code).rootNode;
  } catch {
    return null;
  }
}

export function detectLanguage(filePath: string): SupportedLanguage {
  const extension = path
    .extname(filePath)
    .toLowerCase() as keyof typeof FILE_EXTENSION_LANGUAGE_MAP;
  return FILE_EXTENSION_LANGUAGE_MAP[extension] ?? "unknown";
}

export function parseSourceToSyntaxTree(input: SourceFileInput): ParseResult {
  const language = detectLanguage(input.path);
  const rootNode = parseCode(input.content);

  if (!rootNode) {
    return {
      filePath: input.path,
      language,
      nodes: [],
    };
  }

  const nodes = rootNode
    .descendantsOfType([...FUNCTION_NODE_TYPES])
    .map((fnNode) => ({
      id: `${input.path}:fn:${fnNode.startIndex}`,
      kind: "function" as const,
      name: resolveFunctionName(fnNode),
      startLine: toLine(fnNode.startPosition),
      endLine: toLine(fnNode.endPosition),
      metadata: {
        scope: "file",
        syntaxType: fnNode.type,
      },
      children: [
        ...toApiChildren(input.path, fnNode),
        ...toTryCatchChildren(input.path, fnNode),
      ],
    }));

  return {
    filePath: input.path,
    language,
    nodes,
  };
}

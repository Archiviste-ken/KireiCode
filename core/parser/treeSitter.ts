import path from "node:path";

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

const FUNCTION_PATTERNS = [
  /\bfunction\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g,
  /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g,
];

const API_CALL_PATTERN = /\b(?:fetch|axios\.(?:get|post|put|delete|patch)|client\.(?:get|post|put|delete|patch))\s*\(\s*(["'`])([^"'`]+)\1/g;

function toLineNumber(source: string, charIndex: number): number {
  return source.slice(0, charIndex).split(/\r?\n/).length;
}

function extractBracedBlock(
  source: string,
  openBraceIndex: number,
): { body: string; endIndex: number } | null {
  if (openBraceIndex < 0 || source[openBraceIndex] !== "{") {
    return null;
  }

  let depth = 0;
  for (let index = openBraceIndex; index < source.length; index += 1) {
    const character = source[index];

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          body: source.slice(openBraceIndex + 1, index),
          endIndex: index,
        };
      }
    }
  }

  return null;
}

export function detectLanguage(filePath: string): SupportedLanguage {
  const extension = path.extname(filePath).toLowerCase() as keyof typeof FILE_EXTENSION_LANGUAGE_MAP;
  return FILE_EXTENSION_LANGUAGE_MAP[extension] ?? "unknown";
}

export function parseSourceToSyntaxTree(input: SourceFileInput): ParseResult {
  const nodes: SyntaxNode[] = [];
  const language = detectLanguage(input.path);

  FUNCTION_PATTERNS.forEach((pattern) => {
    let match = pattern.exec(input.content);
    while (match) {
      const functionName = match[1] ?? "anonymous";
      const functionStart = match.index;
      const openBraceIndex = input.content.indexOf("{", functionStart);
      const extractedBlock = extractBracedBlock(input.content, openBraceIndex);

      if (extractedBlock) {
        const functionNode: SyntaxNode = {
          id: `${input.path}:fn:${functionStart}`,
          kind: "function",
          name: functionName,
          startLine: toLineNumber(input.content, functionStart),
          endLine: toLineNumber(input.content, extractedBlock.endIndex),
          metadata: {
            scope: "file",
          },
          children: [],
        };

        let apiMatch = API_CALL_PATTERN.exec(extractedBlock.body);
        while (apiMatch) {
          const endpoint = apiMatch[2] ?? "unknown-endpoint";
          const relativeIndex = apiMatch.index;
          const absoluteIndex = functionStart + relativeIndex;

          functionNode.children.push({
            id: `${input.path}:api:${absoluteIndex}`,
            kind: "api-call",
            name: endpoint,
            startLine: toLineNumber(input.content, absoluteIndex),
            endLine: toLineNumber(input.content, absoluteIndex),
            metadata: {
              endpoint,
            },
            children: [],
          });

          apiMatch = API_CALL_PATTERN.exec(extractedBlock.body);
        }

        if (/\btry\s*\{/.test(extractedBlock.body) && /\bcatch\s*\(/.test(extractedBlock.body)) {
          functionNode.children.push({
            id: `${input.path}:tc:${functionStart}`,
            kind: "try-catch",
            name: `try-catch:${functionName}`,
            startLine: functionNode.startLine,
            endLine: functionNode.endLine,
            metadata: {
              guarded: true,
            },
            children: [],
          });
        }

        nodes.push(functionNode);
      }

      match = pattern.exec(input.content);
    }
  });

  return {
    filePath: input.path,
    language,
    nodes,
  };
}

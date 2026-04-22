import type { IRFile, IRNode } from "@/core/ir";

import type { ParseResult, SyntaxNode } from "./treeSitter";

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

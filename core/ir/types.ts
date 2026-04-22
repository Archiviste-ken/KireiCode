export type SupportedLanguage = "typescript" | "javascript" | "unknown";

export interface SourceFileInput {
  path: string;
  content: string;
}

export interface SourceLocation {
  startLine: number;
  endLine: number;
}

export type IRNodeKind = "function" | "api-call" | "try-catch" | "unknown";

export interface IRNode {
  id: string;
  kind: IRNodeKind;
  name: string;
  location: SourceLocation;
  metadata: Record<string, string | number | boolean>;
  parentId?: string;
}

export interface IRFile {
  filePath: string;
  language: SupportedLanguage;
  nodes: IRNode[];
}

export interface CodeRepositoryIR {
  files: IRFile[];
}

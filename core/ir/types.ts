export type SupportedLanguage = "typescript" | "javascript" | "unknown";

export interface SourceFileInput {
  path: string;
  content: string;
}

export interface SourceLocation {
  startLine: number;
  endLine: number;
}

export type DependencyKind = "import" | "require" | "dynamic-import";

export interface IRDependency {
  id: string;
  sourceFilePath: string;
  target: string;
  kind: DependencyKind;
  isExternal: boolean;
  importedSymbols: string[];
}

export interface IRFunctionCall {
  calleeName: string;
  calleeId?: string;
  location?: SourceLocation;
}

export interface IRFunction {
  id: string;
  name: string;
  filePath: string;
  functionCalls: IRFunctionCall[];
  isAsync: boolean;
  hasTryCatch: boolean;
  complexityScore: number;
  location?: SourceLocation;
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
  functions?: IRFunction[];
  dependencies?: IRDependency[];

  // Legacy node model kept for compatibility with current graph/rule/analyzer pipeline.
  nodes: IRNode[];
}

export interface NormalizedIRFile extends Omit<
  IRFile,
  "functions" | "dependencies"
> {
  functions: IRFunction[];
  dependencies: IRDependency[];
}

export interface CodeRepositoryIR {
  files: IRFile[];

  // Optional flattened views to simplify downstream analysis stages.
  functions?: IRFunction[];
  dependencies?: IRDependency[];
}

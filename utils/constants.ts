export const DEFAULT_MAX_FILES = 400;
export const DEFAULT_TRACE_DEPTH = 4;

export const SUPPORTED_SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
] as const;

export const IGNORED_DIRECTORIES = [
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
] as const;

export const FILE_EXTENSION_LANGUAGE_MAP = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
} as const;

export const RULE_SEVERITY_WEIGHT = {
  low: 1,
  medium: 3,
  high: 5,
} as const;

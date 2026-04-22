import path from "node:path";
import { readFile, readdir } from "node:fs/promises";

import type { AnalyzeRepositoryOptions, SourceFileInput } from "@/core";
import { DEFAULT_MAX_FILES } from "@/utils";

const DEFAULT_INCLUDE_EXTENSIONS = [".js", ".ts", ".jsx", ".tsx"] as const;
const BASE_IGNORED_DIRECTORIES = new Set(["node_modules", ".git"]);

export interface ScanRepositoryOptions {
  includeExtensions?: string[];
  maxFiles?: number;
}

async function collectFiles(
  directoryPath: string,
  output: string[],
  ignoredDirectories: Set<string>,
): Promise<void> {
  const entries = await readdir(directoryPath, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const resolved = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name)) {
          return;
        }
        await collectFiles(resolved, output, ignoredDirectories);
        return;
      }

      output.push(resolved);
    }),
  );
}

function toScannerOptions(
  options?: ScanRepositoryOptions | AnalyzeRepositoryOptions,
): ScanRepositoryOptions {
  const normalized: ScanRepositoryOptions = {};

  if (options?.includeExtensions) {
    normalized.includeExtensions = options.includeExtensions;
  }

  if (typeof options?.maxFiles === "number") {
    normalized.maxFiles = options.maxFiles;
  }

  return normalized;
}

export async function scanRepositoryFiles(
  repositoryPath: string,
  options?: ScanRepositoryOptions | AnalyzeRepositoryOptions,
): Promise<SourceFileInput[]> {
  const normalizedOptions = toScannerOptions(options);

  const extensions = new Set(
    (normalizedOptions.includeExtensions?.length
      ? normalizedOptions.includeExtensions
      : [...DEFAULT_INCLUDE_EXTENSIONS]
    ).map((item) => item.toLowerCase()),
  );

  const ignoredDirectories = new Set(BASE_IGNORED_DIRECTORIES);

  const discoveredFiles: string[] = [];
  await collectFiles(repositoryPath, discoveredFiles, ignoredDirectories);

  const selectedFiles = discoveredFiles
    .filter((filePath) => extensions.has(path.extname(filePath).toLowerCase()))
    .slice(0, normalizedOptions.maxFiles ?? DEFAULT_MAX_FILES);

  return Promise.all(
    selectedFiles.map(async (filePath) => ({
      path: filePath,
      content: await readFile(filePath, "utf-8"),
    })),
  );
}

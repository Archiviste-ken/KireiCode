import path from "node:path";
import { readFile, readdir } from "node:fs/promises";

import type { AnalyzeRepositoryOptions, SourceFileInput } from "@/core";
import {
  DEFAULT_MAX_FILES,
  IGNORED_DIRECTORIES,
  SUPPORTED_SOURCE_EXTENSIONS,
} from "@/utils";

export interface ScanRepositoryOptions {
  includeExtensions?: string[];
  maxFiles?: number;
}

async function collectFiles(
  directoryPath: string,
  output: string[],
): Promise<void> {
  const entries = await readdir(directoryPath, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const resolved = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        if (
          IGNORED_DIRECTORIES.includes(
            entry.name as (typeof IGNORED_DIRECTORIES)[number],
          )
        ) {
          return;
        }
        await collectFiles(resolved, output);
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
      : [...SUPPORTED_SOURCE_EXTENSIONS]
    ).map((item) => item.toLowerCase()),
  );

  const discoveredFiles: string[] = [];
  await collectFiles(repositoryPath, discoveredFiles);

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

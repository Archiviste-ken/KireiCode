import path from "node:path";
import { mkdir, rm, stat } from "node:fs/promises";

import { simpleGit } from "simple-git";

export type ExistingFolderStrategy = "reuse" | "clean" | "error";

export interface CloneRepositoryInput {
  repositoryUrl: string;
  targetDirectory: string;
  branch?: string;
  depth?: number;
  existingFolderStrategy?: ExistingFolderStrategy;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function isGitRepository(targetPath: string): Promise<boolean> {
  return pathExists(path.join(targetPath, ".git"));
}

function normalizeRemoteUrl(remote: string): string {
  return remote
    .trim()
    .replace(/\.git$/i, "")
    .toLowerCase();
}

export async function cloneRepository(
  input: CloneRepositoryInput,
): Promise<string> {
  const destination = path.resolve(input.targetDirectory);
  const strategy = input.existingFolderStrategy ?? "reuse";
  const exists = await pathExists(destination);

  if (exists) {
    if (strategy === "clean") {
      await rm(destination, { recursive: true, force: true });
    } else if (strategy === "error") {
      throw new Error(
        `Target directory already exists: ${destination}. Use existingFolderStrategy=\"reuse\" or \"clean\".`,
      );
    } else {
      const gitInTarget = simpleGit(destination);
      const isRepo = await isGitRepository(destination);

      if (!isRepo) {
        throw new Error(
          `Target directory exists but is not a Git repository: ${destination}.`,
        );
      }

      const remoteUrl = await gitInTarget.remote(["get-url", "origin"]);
      if (
        normalizeRemoteUrl(remoteUrl) !==
        normalizeRemoteUrl(input.repositoryUrl)
      ) {
        throw new Error(
          `Target directory exists with a different origin remote: ${destination}.`,
        );
      }

      await gitInTarget.fetch();
      if (input.branch) {
        await gitInTarget.checkout(input.branch);
        await gitInTarget.pull("origin", input.branch);
      } else {
        await gitInTarget.pull();
      }
      return destination;
    }
  }

  await mkdir(path.dirname(destination), { recursive: true });

  const git = simpleGit();
  const cloneArgs: string[] = ["--depth", String(input.depth ?? 1)];

  if (input.branch) {
    cloneArgs.push("--branch", input.branch);
  }

  await git.clone(input.repositoryUrl, destination, cloneArgs);

  return destination;
}

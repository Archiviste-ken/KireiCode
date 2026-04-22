import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);

export interface CloneRepositoryInput {
  repositoryUrl: string;
  targetDirectory: string;
  branch?: string;
  depth?: number;
}

export async function cloneRepository(
  input: CloneRepositoryInput,
): Promise<string> {
  const destination = path.resolve(input.targetDirectory);
  const args = [
    "clone",
    input.repositoryUrl,
    destination,
    "--depth",
    String(input.depth ?? 1),
  ];

  if (input.branch) {
    args.push("--branch", input.branch);
  }

  await execFileAsync("git", args, {
    windowsHide: true,
  });

  return destination;
}

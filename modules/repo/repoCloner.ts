import path from "node:path";
import { mkdir, rm, stat, readdir, rename } from "node:fs/promises";
import https from "node:https";
import AdmZip from "adm-zip";

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

  if (process.env.VERCEL) {
    let repoUrl = input.repositoryUrl;
    if (repoUrl.endsWith(".git")) repoUrl = repoUrl.slice(0, -4);
    
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      throw new Error("Only GitHub repositories are supported in Vercel serverless mode.");
    }
    
    if (exists && strategy === "clean") {
      await rm(destination, { recursive: true, force: true });
    }
    await mkdir(destination, { recursive: true });
    
    const branch = input.branch || "main";
    const zipUrl = `${repoUrl}/archive/refs/heads/${branch}.zip`;
    
    await new Promise<void>((resolve, reject) => {
      const download = (url: string) => {
        https.get(url, { headers: { "User-Agent": "KireiCode-Engine" } }, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
             return download(res.headers.location!);
          }
          if (res.statusCode !== 200) {
             if (branch === "main") {
                const masterUrl = `${repoUrl}/archive/refs/heads/master.zip`;
                https.get(masterUrl, { headers: { "User-Agent": "KireiCode-Engine" } }, (res2) => {
                   if (res2.statusCode === 301 || res2.statusCode === 302) {
                      return download(res2.headers.location!);
                   }
                   if (res2.statusCode !== 200) {
                      return reject(new Error(`Failed to download repository zip. Status: ${res2.statusCode}`));
                   }
                   processRes(res2);
                }).on("error", reject);
                return;
             }
             return reject(new Error(`Failed to download repository zip: ${res.statusCode}`));
          }
          processRes(res);
        }).on("error", reject);
      };
      
      const processRes = (res: any) => {
          const data: Buffer[] = [];
          res.on("data", (chunk: Buffer) => data.push(chunk));
          res.on("end", async () => {
            try {
              const buffer = Buffer.concat(data);
              const zip = new AdmZip(buffer);
              zip.extractAllTo(destination, true);
              
              const extractedDirs = await readdir(destination);
              const firstDir = extractedDirs[0];
              if (extractedDirs.length === 1 && firstDir) {
                 const rootFolder = path.join(destination, firstDir);
                 const s = await stat(rootFolder);
                 if (s.isDirectory()) {
                    const files = await readdir(rootFolder);
                    for (const file of files) {
                       await rename(path.join(rootFolder, file), path.join(destination, file));
                    }
                    await rm(rootFolder, { recursive: true, force: true });
                 }
              }
              resolve();
            } catch (e) {
              reject(e);
            }
          });
      };
      download(zipUrl);
    });
    
    return destination;
  }

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
      if (typeof remoteUrl !== "string" || remoteUrl.trim().length === 0) {
        throw new Error(
          `Unable to read origin remote for existing repository: ${destination}.`,
        );
      }

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

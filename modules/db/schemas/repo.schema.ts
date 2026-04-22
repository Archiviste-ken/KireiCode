export interface RepositoryRecord {
  id: string;
  url: string;
  branch: string;
  scannedAt: string;
}

export function createRepositoryRecord(
  input: Omit<RepositoryRecord, "id" | "scannedAt">,
): RepositoryRecord {
  return {
    id: crypto.randomUUID(),
    url: input.url,
    branch: input.branch,
    scannedAt: new Date().toISOString(),
  };
}

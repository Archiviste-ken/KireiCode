import { createAnalysisRecord, createRepositoryRecord } from "./schemas";
import type { AnalysisRecord, RepositoryRecord } from "./schemas";

export interface MongoAdapter {
  insertRepository(input: Omit<RepositoryRecord, "id" | "scannedAt">): Promise<RepositoryRecord>;
  insertAnalysis(input: Omit<AnalysisRecord, "id" | "createdAt">): Promise<AnalysisRecord>;
  findRepositoryByUrl(url: string): Promise<RepositoryRecord | null>;
}

class InMemoryMongoAdapter implements MongoAdapter {
  private readonly repositories = new Map<string, RepositoryRecord>();
  private readonly analyses = new Map<string, AnalysisRecord>();

  async insertRepository(
    input: Omit<RepositoryRecord, "id" | "scannedAt">,
  ): Promise<RepositoryRecord> {
    const record = createRepositoryRecord(input);
    this.repositories.set(record.id, record);
    return record;
  }

  async insertAnalysis(input: Omit<AnalysisRecord, "id" | "createdAt">): Promise<AnalysisRecord> {
    const record = createAnalysisRecord(input);
    this.analyses.set(record.id, record);
    return record;
  }

  async findRepositoryByUrl(url: string): Promise<RepositoryRecord | null> {
    for (const record of this.repositories.values()) {
      if (record.url === url) {
        return record;
      }
    }

    return null;
  }
}

let adapter: MongoAdapter | null = null;

export function getMongoAdapter(): MongoAdapter {
  if (!adapter) {
    adapter = new InMemoryMongoAdapter();
  }

  return adapter;
}

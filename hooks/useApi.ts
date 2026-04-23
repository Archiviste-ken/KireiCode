import { useCallback, useState } from "react";

import type {
  AnalyzeRepositoryOptions,
  RepositoryAnalysisResult,
} from "@/core";

const ANALYSIS_STORAGE_KEY = "kireicode:last-analysis";

export type Status = "idle" | "analyzing" | "done";

export interface StoredAnalysis {
  repoUrl: string;
  analysis: RepositoryAnalysisResult;
  createdAt: string;
}

type AnalyzeSuccessResponse = RepositoryAnalysisResult;

interface ApiErrorResponse {
  error?: string;
}

function readStoredAnalysis(): StoredAnalysis | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(ANALYSIS_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as StoredAnalysis;
  } catch {
    return null;
  }
}

function writeStoredAnalysis(payload: StoredAnalysis): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ANALYSIS_STORAGE_KEY, JSON.stringify(payload));
}

export function useApi() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<StoredAnalysis | null>(() =>
    readStoredAnalysis(),
  );

  const triggerAnalysis = useCallback(
    async (repoUrl: string, options?: AnalyzeRepositoryOptions) => {
      setStatus("analyzing");
      setError(null);

      if (!repoUrl) {
        setError("Repository URL is required");
        setStatus("idle");
        return false;
      }

      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ repoUrl, options }),
        });

        if (!response.ok) {
          const payload = (await response
            .json()
            .catch(() => ({}))) as ApiErrorResponse;
          setError(payload.error ?? "Analysis failed");
          setStatus("idle");
          return false;
        }

        const analysis = (await response.json()) as AnalyzeSuccessResponse;
        const payload: StoredAnalysis = {
          repoUrl,
          analysis,
          createdAt: new Date().toISOString(),
        };

        writeStoredAnalysis(payload);
        setLastAnalysis(payload);
        setStatus("done");
        return true;
      } catch {
        setError("Unable to reach analysis service");
        setStatus("idle");
        return false;
      }
    },
    [],
  );

  const requestChat = useCallback(async (prompt: string) => {
    setError(null);

    const analysisPayload = readStoredAnalysis();
    if (!analysisPayload?.analysis) {
      setError("Run an analysis first before using chat.");
      return null;
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          analysis: analysisPayload.analysis,
        }),
      });

      if (!response.ok) {
        const payload = (await response
          .json()
          .catch(() => ({}))) as ApiErrorResponse;
        setError(payload.error ?? "Chat request failed");
        return null;
      }

      const payload = (await response.json()) as { content?: string };
      return payload.content ?? null;
    } catch {
      setError("Unable to reach chat service");
      return null;
    }
  }, []);

  const resetStatus = useCallback(() => setStatus("idle"), []);

  const clearAnalysis = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ANALYSIS_STORAGE_KEY);
    }
    setLastAnalysis(null);
  }, []);

  const refreshLastAnalysis = useCallback(() => {
    setLastAnalysis(readStoredAnalysis());
  }, []);

  return {
    status,
    error,
    lastAnalysis,
    triggerAnalysis,
    requestChat,
    resetStatus,
    clearAnalysis,
    refreshLastAnalysis,
  };
}

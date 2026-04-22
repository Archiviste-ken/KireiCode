import { NextResponse } from "next/server";

import { analyzeRepository } from "@/core";
import { logger } from "@/utils";

export const runtime = "nodejs";

interface AnalyzeRouteBody {
  repoUrl: string;
  cloneTargetDirectory?: string;
  cloneBranch?: string;
  cloneDepth?: number;
  existingFolderStrategy?: "reuse" | "clean" | "error";
  options?: {
    maxFiles?: number;
    includeExtensions?: string[];
    traceFromNodeId?: string;
    traceDepth?: number;
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as AnalyzeRouteBody;

    if (!body.repoUrl) {
      return NextResponse.json(
        { error: "`repoUrl` is required." },
        { status: 400 },
      );
    }

    const pipelineInput = {
      repositoryUrl: body.repoUrl,
      ...(body.cloneTargetDirectory
        ? { cloneTargetDirectory: body.cloneTargetDirectory }
        : {}),
      ...(body.cloneBranch ? { cloneBranch: body.cloneBranch } : {}),
      ...(typeof body.cloneDepth === "number"
        ? { cloneDepth: body.cloneDepth }
        : {}),
      ...(body.existingFolderStrategy
        ? { existingFolderStrategy: body.existingFolderStrategy }
        : {}),
      ...(body.options ? { options: body.options } : {}),
    };

    const result = await analyzeRepository(pipelineInput);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error("Analyze route failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to run analysis." },
      { status: 500 },
    );
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json(
    {
      status: "ok",
      service: "analysis-engine",
    },
    { status: 200 },
  );
}

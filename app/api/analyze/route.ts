import { NextResponse } from "next/server";

import { analyzeRepository } from "@/core";
import { scanRepositoryFiles } from "@/modules";
import type { AnalyzeRequestBody } from "@/types";
import { logger } from "@/utils";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as AnalyzeRequestBody;
    let files = body.files ?? [];

    if (files.length === 0 && body.repositoryPath) {
      files = await scanRepositoryFiles(body.repositoryPath, body.options);
    }

    if (files.length === 0) {
      return NextResponse.json(
        {
          error:
            "No source files found. Provide `files` or a valid `repositoryPath`.",
        },
        { status: 400 },
      );
    }

    const result = await analyzeRepository(
      body.options
        ? {
            files,
            options: body.options,
          }
        : { files },
    );

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

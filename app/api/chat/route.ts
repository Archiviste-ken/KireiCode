import { NextResponse } from "next/server";

import { generateExplanation } from "@/modules";
import type { ChatRequestBody, ChatResponseBody } from "@/types";
import { logger } from "@/utils";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as ChatRequestBody;

    if (!body.prompt || !body.analysis) {
      return NextResponse.json(
        { error: "`prompt` and `analysis` are required." },
        { status: 400 },
      );
    }

    const content = await generateExplanation({
      prompt: body.prompt,
      analysis: body.analysis,
    });

    const response: ChatResponseBody = { content };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    logger.error("Chat route failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to generate explanation." },
      { status: 500 },
    );
  }
}

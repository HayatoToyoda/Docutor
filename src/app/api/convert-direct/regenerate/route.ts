import { NextResponse } from "next/server";
import {
  OpenAIProviderError,
  regenerateDirectSection,
} from "@/lib/llm/openai-provider";
import { jsonError } from "@/lib/server/http";
import type { ReviewSection, SourceFileType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type RegenerateRequestBody = {
  title?: string;
  sourceFileName?: string;
  sourceFileType?: SourceFileType;
  sections?: ReviewSection[];
  sectionId?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as RegenerateRequestBody;

  if (
    !body.title ||
    !body.sourceFileName ||
    !body.sourceFileType ||
    !Array.isArray(body.sections) ||
    !body.sectionId
  ) {
    return jsonError(
      "title, sourceFileName, sourceFileType, sections, and sectionId are required.",
    );
  }

  const section = body.sections.find(
    (candidate) => candidate.id === body.sectionId,
  );

  if (!section) {
    return jsonError("Section not found.", 404);
  }

  try {
    const regenerated = await regenerateDirectSection(
      {
        title: body.title,
        sourceFileName: body.sourceFileName,
        sourceFileType: body.sourceFileType,
        sections: body.sections,
      },
      section,
    );

    return NextResponse.json({ section: regenerated });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof OpenAIProviderError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Section regeneration failed.";
    return jsonError(message, 500);
  }
}

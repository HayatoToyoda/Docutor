import { NextResponse } from "next/server";
import { appendInstructionNote } from "@/lib/document-model";
import { regenerateDirectSection } from "@/lib/llm/openai-provider";
import { jsonError } from "@/lib/server/http";
import type { ReviewSection, SourceFileType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

// With the client stripping sourceImage data URLs before sending sections
// (see the review page), legitimate request bodies stay small; this caps
// abusive/oversized payloads before they're even parsed as JSON.
const MAX_BODY_CHARS = 1_000_000;
const MAX_SECTIONS = 200;
// Optional reviewer instruction (F-3); capped well below MAX_BODY_CHARS so a
// runaway instruction can't be used to smuggle an oversized prompt in.
const MAX_INSTRUCTION_CHARS = 2000;

type RegenerateRequestBody = {
  title?: string;
  sourceFileName?: string;
  sourceFileType?: SourceFileType;
  sections?: ReviewSection[];
  sectionId?: string;
  instruction?: string;
};

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (rawBody.length > MAX_BODY_CHARS) {
    return jsonError("Request body is too large.", 413);
  }

  let body: RegenerateRequestBody;
  try {
    body = JSON.parse(rawBody) as RegenerateRequestBody;
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

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

  if (body.sections.length > MAX_SECTIONS) {
    return jsonError(`sections cannot contain more than ${MAX_SECTIONS} items.`);
  }

  if (
    body.instruction !== undefined &&
    (typeof body.instruction !== "string" ||
      body.instruction.length > MAX_INSTRUCTION_CHARS)
  ) {
    return jsonError(
      `instruction cannot exceed ${MAX_INSTRUCTION_CHARS} characters.`,
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
      { instruction: body.instruction },
    );

    // Audit trail (F-3): fold the prior section's notes back in (the model
    // output normalizeReviewSection produces replaces `notes` outright) and
    // record the instruction, so instructed regenerations leave a visible
    // history instead of silently dropping the prior notes.
    const finalSection = body.instruction?.trim()
      ? appendInstructionNote(
          {
            ...regenerated,
            notes: [...(section.notes ?? []), ...(regenerated.notes ?? [])],
          },
          body.instruction,
        )
      : regenerated;

    return NextResponse.json({ section: finalSection });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "Section regeneration failed.";
    return jsonError(message, 500);
  }
}

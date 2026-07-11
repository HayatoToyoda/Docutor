import { NextResponse } from "next/server";
import { appendInstructionNote } from "@/lib/document-model";
import { createConversionProvider } from "@/lib/llm/providers";
import { jsonError } from "@/lib/server/http";
import { readDocumentJob, saveDocumentJob } from "@/lib/server/storage";

export const runtime = "nodejs";

// Optional reviewer instruction (F-3), capped to keep abusive payloads out
// of the regeneration prompt.
const MAX_INSTRUCTION_CHARS = 2000;

// This route's body only ever carries a short instruction string, so cap
// the raw body well below the direct-regenerate route's limit (which also
// carries a full sections array) and check it before parsing — matching
// that route's raw-text-first pattern instead of buffering an unbounded
// body straight into request.json().
const MAX_BODY_CHARS = 10_000;

type RouteContext = {
  params: Promise<{ id: string; sectionId: string }>;
};

type RegenerateRequestBody = {
  instruction?: string;
};

// This route previously took no request body at all (a bare POST). F-3
// adds an *optional* JSON body carrying a reviewer instruction, so a
// missing body, an empty body, an oversized body, or a non-JSON body must
// all keep working as "no instruction" rather than failing the request.
async function readInstruction(request: Request): Promise<string | undefined> {
  const rawBody = await request.text();

  if (!rawBody || rawBody.length > MAX_BODY_CHARS) {
    return undefined;
  }

  let body: RegenerateRequestBody;
  try {
    body = JSON.parse(rawBody) as RegenerateRequestBody;
  } catch {
    return undefined;
  }

  if (typeof body?.instruction !== "string") {
    return undefined;
  }

  return body.instruction.slice(0, MAX_INSTRUCTION_CHARS);
}

export async function POST(request: Request, context: RouteContext) {
  const { id, sectionId } = await context.params;
  const instruction = await readInstruction(request);
  const document = await readDocumentJob(id);

  if (!document?.reviewDocument || !document.normalizedDocument) {
    return jsonError("Converted review document not found.", 404);
  }

  const sectionIndex = document.reviewDocument.sections.findIndex(
    (section) => section.id === sectionId,
  );

  if (sectionIndex === -1) {
    return jsonError("Section not found.", 404);
  }

  // Always use the env-configured default provider — regeneration must not
  // be forceable to a different (e.g. mock) provider via a request param.
  const provider = createConversionProvider();

  if (!provider.regenerateSection) {
    return jsonError("Selected provider does not support regeneration.", 501);
  }

  const sections = [...document.reviewDocument.sections];
  sections[sectionIndex] = {
    ...sections[sectionIndex],
    reviewStatus: "regenerating",
  };
  const regeneratingJob = await saveDocumentJob({
    ...document,
    reviewDocument: {
      ...document.reviewDocument,
      updatedAt: new Date().toISOString(),
      sections,
    },
  });

  const regeneratingReviewDocument = regeneratingJob.reviewDocument;
  if (!regeneratingReviewDocument) {
    return jsonError("Converted review document not found.", 500);
  }

  try {
    const previousSection = document.reviewDocument.sections[sectionIndex];
    const regeneratedSection = await provider.regenerateSection(
      document.normalizedDocument,
      previousSection,
      { instruction },
    );

    // Audit trail (F-3): normalizeReviewSection sets `notes` purely from the
    // model's output, discarding the prior section's notes. When an
    // instruction was given, fold the prior notes back in and record the
    // instruction so the regeneration leaves a visible history.
    const finalSection = instruction?.trim()
      ? appendInstructionNote(
          {
            ...regeneratedSection,
            notes: [
              ...(previousSection.notes ?? []),
              ...(regeneratedSection.notes ?? []),
            ],
          },
          instruction,
        )
      : regeneratedSection;
    sections[sectionIndex] = finalSection;

    const updated = await saveDocumentJob({
      ...regeneratingJob,
      reviewDocument: {
        ...regeneratingReviewDocument,
        updatedAt: new Date().toISOString(),
        sections,
      },
    });

    return NextResponse.json({ document: updated, section: finalSection });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Section regeneration failed.";
    const previousSection = document.reviewDocument.sections[sectionIndex];
    sections[sectionIndex] = {
      ...previousSection,
      reviewStatus: "pending",
      notes: [...(previousSection.notes ?? []), message],
    };
    const failed = await saveDocumentJob({
      ...regeneratingJob,
      reviewDocument: {
        ...regeneratingReviewDocument,
        updatedAt: new Date().toISOString(),
        sections,
      },
    });
    return NextResponse.json({ document: failed, error: message }, { status: 500 });
  }
}

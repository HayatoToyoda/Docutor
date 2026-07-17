import { NextResponse } from "next/server";
import { applySectionPatch, sanitizeSectionPatch } from "@/lib/document-model";
import { getDocumentRepository } from "@/lib/server/document-repository";
import { jsonError } from "@/lib/server/http";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; sectionId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id, sectionId } = await context.params;
  const repository = getDocumentRepository();
  const document = await repository.get(id);

  if (!document?.reviewDocument) {
    return jsonError("Review document not found.", 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be valid JSON.");
  }

  // applySectionPatch spreads the patch onto the stored section, so the raw
  // body must never reach it: sanitizeSectionPatch keeps only the
  // SectionPatch contract's five fields (dropping e.g. an attempt to
  // overwrite id/type/sourceImage) and rejects wrong-typed values.
  const patch = sanitizeSectionPatch(body);
  if (!patch) {
    return jsonError(
      "Request body must be a section patch: generatedMarkdown, generatedCode, drawioXml, reviewStatus, and/or notes.",
    );
  }

  const sectionExists = document.reviewDocument.sections.some(
    (section) => section.id === sectionId,
  );

  if (!sectionExists) {
    return jsonError("Section not found.", 404);
  }

  const reviewDocument = applySectionPatch(
    document.reviewDocument,
    sectionId,
    patch,
  );
  const nextSection = reviewDocument.sections.find(
    (section) => section.id === sectionId,
  )!;

  const updated = await repository.save({
    ...document,
    reviewDocument,
  });

  return NextResponse.json({ document: updated, section: nextSection });
}

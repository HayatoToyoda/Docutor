import { NextResponse } from "next/server";
import { applySectionPatch, type SectionPatch } from "@/lib/document-model";
import { jsonError } from "@/lib/server/http";
import { readDocumentJob, saveDocumentJob } from "@/lib/server/storage";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; sectionId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id, sectionId } = await context.params;
  const document = await readDocumentJob(id);

  if (!document?.reviewDocument) {
    return jsonError("Review document not found.", 404);
  }

  const patch = (await request.json()) as SectionPatch;
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

  const updated = await saveDocumentJob({
    ...document,
    reviewDocument,
  });

  return NextResponse.json({ document: updated, section: nextSection });
}

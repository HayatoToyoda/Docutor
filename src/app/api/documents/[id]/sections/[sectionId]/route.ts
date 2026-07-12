import { NextResponse } from "next/server";
import { applySectionPatch, type SectionPatch } from "@/lib/document-model";
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

  const updated = await repository.save({
    ...document,
    reviewDocument,
  });

  return NextResponse.json({ document: updated, section: nextSection });
}

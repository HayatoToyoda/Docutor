import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/http";
import { readDocumentJob, saveDocumentJob } from "@/lib/server/storage";
import type { ReviewSection } from "@/lib/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; sectionId: string }>;
};

type SectionPatch = {
  generatedMarkdown?: string;
  generatedCode?: string;
  drawioXml?: string;
  reviewStatus?: ReviewSection["reviewStatus"];
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id, sectionId } = await context.params;
  const document = await readDocumentJob(id);

  if (!document?.reviewDocument) {
    return jsonError("Review document not found.", 404);
  }

  const patch = (await request.json()) as SectionPatch;
  const sectionIndex = document.reviewDocument.sections.findIndex(
    (section) => section.id === sectionId,
  );

  if (sectionIndex === -1) {
    return jsonError("Section not found.", 404);
  }

  const section = document.reviewDocument.sections[sectionIndex];
  const nextSection = {
    ...section,
    ...patch,
  } as ReviewSection;

  const sections = [...document.reviewDocument.sections];
  sections[sectionIndex] = nextSection;

  const updated = await saveDocumentJob({
    ...document,
    reviewDocument: {
      ...document.reviewDocument,
      updatedAt: new Date().toISOString(),
      sections,
    },
  });

  return NextResponse.json({ document: updated, section: nextSection });
}

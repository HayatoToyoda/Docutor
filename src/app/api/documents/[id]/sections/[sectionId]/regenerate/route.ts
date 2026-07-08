import { NextResponse } from "next/server";
import { createConversionProvider } from "@/lib/llm/providers";
import { jsonError } from "@/lib/server/http";
import { readDocumentJob, saveDocumentJob } from "@/lib/server/storage";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; sectionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { id, sectionId } = await context.params;
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
    const regeneratedSection = await provider.regenerateSection(
      document.normalizedDocument,
      document.reviewDocument.sections[sectionIndex],
    );
    sections[sectionIndex] = regeneratedSection;

    const updated = await saveDocumentJob({
      ...regeneratingJob,
      reviewDocument: {
        ...regeneratingReviewDocument,
        updatedAt: new Date().toISOString(),
        sections,
      },
    });

    return NextResponse.json({ document: updated, section: regeneratedSection });
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

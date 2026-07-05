import { NextResponse } from "next/server";
import { createConversionProvider } from "@/lib/llm/providers";
import { jsonError } from "@/lib/server/http";
import { readDocumentJob, saveDocumentJob } from "@/lib/server/storage";
import type { ConversionProviderName } from "@/lib/types";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; sectionId: string }>;
};

function providerFromRequest(request: Request): ConversionProviderName | undefined {
  const provider = new URL(request.url).searchParams.get("provider");
  if (!provider) {
    return undefined;
  }

  if (provider === "openai" || provider === "mock" || provider === "codex-local") {
    return provider;
  }

  throw new Error("Unsupported conversion provider.");
}

export async function POST(request: Request, context: RouteContext) {
  const { id, sectionId } = await context.params;
  const document = await readDocumentJob(id);

  if (!document?.reviewDocument || !document.normalizedDocument) {
    return jsonError("Converted review document not found.", 404);
  }

  let providerName: ConversionProviderName | undefined;
  try {
    providerName = providerFromRequest(request);
  } catch (error) {
    return jsonError((error as Error).message, 400);
  }

  const sectionIndex = document.reviewDocument.sections.findIndex(
    (section) => section.id === sectionId,
  );

  if (sectionIndex === -1) {
    return jsonError("Section not found.", 404);
  }

  const provider = createConversionProvider(providerName);

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

  try {
    const regeneratedSection = await provider.regenerateSection(
      document.normalizedDocument,
      document.reviewDocument.sections[sectionIndex],
    );
    sections[sectionIndex] = regeneratedSection;

    const updated = await saveDocumentJob({
      ...regeneratingJob,
      reviewDocument: {
        ...regeneratingJob.reviewDocument!,
        updatedAt: new Date().toISOString(),
        sections,
      },
    });

    return NextResponse.json({ document: updated, section: regeneratedSection });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Section regeneration failed.";
    sections[sectionIndex] = {
      ...document.reviewDocument.sections[sectionIndex],
      reviewStatus: "pending",
      notes: [
        ...(document.reviewDocument.sections[sectionIndex].notes ?? []),
        message,
      ],
    };
    const failed = await saveDocumentJob({
      ...document,
      reviewDocument: {
        ...document.reviewDocument,
        updatedAt: new Date().toISOString(),
        sections,
      },
    });
    return NextResponse.json({ document: failed, error: message }, { status: 500 });
  }
}

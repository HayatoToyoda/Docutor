import type {
  ReviewDocumentOutput,
  ReviewSectionOutput,
} from "@/lib/llm/review-document-schema";
import type {
  NormalizedDocument,
  ReviewAsset,
  ReviewDocument,
  ReviewSection,
} from "@/lib/types";

// A distributive Omit: plain `Omit<ReviewSection, "reviewStatus">` would
// collapse the NonDiagramSection | DiagramSection union down to their
// shared keys, losing the `type` discriminant that callers rely on to
// narrow. Distributing over the union first preserves it.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K & keyof T>
  : never;

/** A model-generated section, before the server stamps on reviewStatus. */
export type ReviewSectionContent = DistributiveOmit<
  ReviewSection,
  "reviewStatus"
>;

/** A model-generated document, before the server stamps on metadata. */
export type ReviewDocumentContent = {
  title: string;
  sections: ReviewSectionContent[];
  warnings: string[];
};

export function normalizeReviewSectionOutput(
  output: ReviewSectionOutput,
): ReviewSectionContent {
  if (output.type !== "diagram") {
    return {
      ...output,
      originalText: output.originalText ?? undefined,
      // The model never produces sourceImage (removed from the schema —
      // see review-document-schema.ts); the server resolves it from
      // sourcePage instead. See normalizeReviewDocument/normalizeReviewSection
      // below.
      sourceImage: undefined,
      notes: output.notes ?? undefined,
    };
  }

  return {
    ...output,
    originalText: output.originalText ?? undefined,
    // DiagramSection.sourceImage is a required string; the server fills in
    // the real value, so default to "" here.
    sourceImage: "",
    notes: output.notes ?? undefined,
    diagramIR: output.diagramIR
      ? {
          ...output.diagramIR,
          nodes: output.diagramIR.nodes.map((node) => ({
            ...node,
            kind: node.kind ?? undefined,
          })),
          edges: output.diagramIR.edges.map((edge) => ({
            ...edge,
            label: edge.label ?? undefined,
          })),
        }
      : undefined,
    drawioXml: output.drawioXml ?? undefined,
  };
}

export function normalizeReviewDocumentOutput(
  output: ReviewDocumentOutput,
): ReviewDocumentContent {
  return {
    title: output.title,
    sections: output.sections.map(normalizeReviewSectionOutput),
    warnings: output.warnings,
  };
}

/**
 * Completes a model-generated review document with the metadata the model
 * is never trusted to provide: document id, source file name/type,
 * createdAt/updatedAt timestamps, per-section reviewStatus, per-diagram
 * sourceImage (resolved from the normalized page rather than the model),
 * and the asset list (derived from the source document, never the model).
 */
export function normalizeReviewDocument(
  output: ReviewDocumentOutput,
  source: NormalizedDocument,
): ReviewDocument {
  const now = new Date().toISOString();
  const content = normalizeReviewDocumentOutput(output);
  const pagesByNumber = new Map(
    source.pages.map((page) => [page.pageNumber, page]),
  );

  const sections: ReviewSection[] = content.sections.map((section) => {
    if (section.type === "diagram") {
      return {
        ...section,
        sourceImage: pagesByNumber.get(section.sourcePage)?.imagePath ?? "",
        reviewStatus: "pending",
      };
    }

    return {
      ...section,
      reviewStatus: "pending",
    };
  });

  const assets: ReviewAsset[] = source.assets.map((asset) => ({
    id: asset.id,
    path: asset.path,
    mimeType: asset.mimeType,
    title: asset.kind,
    sourcePage: asset.sourcePage,
  }));

  return {
    id: source.id,
    title: content.title,
    sourceFileName: source.sourceFileName,
    sourceFileType: source.fileType,
    createdAt: now,
    updatedAt: now,
    sections,
    assets,
    warnings: [...source.warnings, ...content.warnings],
  };
}

/**
 * Completes a model-generated section regeneration with the metadata the
 * model never controls: id and sourcePage are kept stable from the prior
 * section, sourceImage always comes from the prior section (the model has
 * no persistent image reference), and originalText falls back to the prior
 * value whenever the regeneration omits it.
 */
export function normalizeReviewSection(
  output: ReviewSectionOutput,
  source: ReviewSection,
): ReviewSection {
  const normalized = normalizeReviewSectionOutput(output);
  const originalText = normalized.originalText || source.originalText;
  const base = {
    id: source.id,
    title: normalized.title,
    sourcePage: output.sourcePage || source.sourcePage,
    originalText,
    generatedMarkdown: normalized.generatedMarkdown,
    notes: normalized.notes,
    reviewStatus: "pending" as const,
  };

  if (source.type === "diagram") {
    const diagramOutput = normalized.type === "diagram" ? normalized : undefined;
    return {
      ...base,
      type: "diagram",
      sourceImage: source.sourceImage,
      format: diagramOutput?.format ?? source.format,
      diagramIR: diagramOutput?.diagramIR,
      generatedCode: diagramOutput?.generatedCode ?? source.generatedCode,
      drawioXml: diagramOutput?.drawioXml,
    };
  }

  return {
    ...base,
    type: source.type,
    // The model never produces sourceImage, so keep whatever the prior
    // section carried instead of erasing it on regeneration.
    sourceImage: normalized.sourceImage ?? source.sourceImage,
  };
}

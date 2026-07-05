import type {
  ReviewDocumentOutput,
  ReviewSectionOutput,
} from "@/lib/llm/review-document-schema";
import type { ReviewDocument, ReviewSection } from "@/lib/types";

export function normalizeReviewSectionOutput(
  output: ReviewSectionOutput,
): ReviewSection {
  if (output.type !== "diagram") {
    return {
      ...output,
      originalText: output.originalText ?? undefined,
      sourceImage: output.sourceImage ?? undefined,
      notes: output.notes ?? undefined,
    };
  }

  return {
    ...output,
    originalText: output.originalText ?? undefined,
    sourceImage: output.sourceImage,
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
): ReviewDocument {
  return {
    ...output,
    sections: output.sections.map(normalizeReviewSectionOutput),
    assets: output.assets.map((asset) => ({
      ...asset,
      sourcePage: asset.sourcePage ?? undefined,
    })),
  };
}

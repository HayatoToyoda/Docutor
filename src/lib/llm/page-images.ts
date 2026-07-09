import type { NormalizedAsset, NormalizedDocument, ReviewDocument } from "@/lib/types";

// Shared between LLM providers (see openai-provider.ts / anthropic-provider.ts):
// every provider attaches up to this many page images to the conversion
// prompt as vision content, and reports any remainder as a warning rather
// than silently dropping them or blowing the request size/cost.
export const MAX_PAGE_IMAGES = 6;

/**
 * Selects the page images a provider should attach to a prompt, capped at
 * MAX_PAGE_IMAGES, and reports how many were left out.
 */
export function collectPageImages(document: NormalizedDocument): {
  pageImages: NormalizedAsset[];
  truncatedPageImageCount: number;
} {
  const allPageImages = document.assets.filter(
    (asset) => asset.kind === "page-image",
  );

  return {
    pageImages: allPageImages.slice(0, MAX_PAGE_IMAGES),
    truncatedPageImageCount: Math.max(
      0,
      allPageImages.length - MAX_PAGE_IMAGES,
    ),
  };
}

/**
 * Appends a warning noting that some page images were not sent to the model
 * (see collectPageImages), if any were truncated.
 */
export function appendPageImageTruncationWarning(
  document: ReviewDocument,
  truncatedPageImageCount: number,
): ReviewDocument {
  if (truncatedPageImageCount <= 0) {
    return document;
  }

  return {
    ...document,
    warnings: [
      ...document.warnings,
      `Only the first ${MAX_PAGE_IMAGES} page images were provided to the model; pages beyond that were converted from extracted text only.`,
    ],
  };
}

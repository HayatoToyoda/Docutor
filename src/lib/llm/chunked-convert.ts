import type {
  ConversionProvider,
  NormalizedDocument,
  NormalizedPage,
  ReviewAsset,
  ReviewDocument,
  ReviewSection,
} from "@/lib/types";
import { MAX_PAGE_IMAGES } from "@/lib/llm/page-images";

// F-10: large documents (many-page PDFs/PPTXs) can exceed a single
// provider.convert call's practical size — both in prompt/context size and
// in how many page images a provider will attach (MAX_PAGE_IMAGES per
// call). Instead of raising per-call limits, the server pipeline splits the
// normalized document into consecutive page windows and calls
// provider.convert once per window, merging the resulting ReviewDocuments.
//
// Default window size matches MAX_PAGE_IMAGES so a single-window call never
// has to silently truncate page images (see page-images.ts).
export const DEFAULT_PAGES_PER_CHUNK = MAX_PAGE_IMAGES;

/**
 * Resolves the configured page-window size from DOCUTOR_PAGES_PER_CHUNK,
 * falling back to DEFAULT_PAGES_PER_CHUNK when unset or not a positive
 * integer.
 */
export function resolvePagesPerChunk(): number {
  const raw = process.env.DOCUTOR_PAGES_PER_CHUNK;
  if (!raw) {
    return DEFAULT_PAGES_PER_CHUNK;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_PAGES_PER_CHUNK;
}

export type PageWindow = {
  /** 0-based window index, in document order. */
  index: number;
  pages: NormalizedPage[];
  /** Inclusive page-number bounds of this window (for progress messages). */
  startPage: number;
  endPage: number;
};

/**
 * Splits `pages` into consecutive windows of at most `size` pages. Always
 * returns at least one (possibly empty) window, so callers can safely rely
 * on `windows[0]` existing.
 */
export function splitIntoPageWindows(
  pages: NormalizedPage[],
  size: number,
): PageWindow[] {
  if (pages.length === 0) {
    return [{ index: 0, pages: [], startPage: 0, endPage: 0 }];
  }

  const windowSize = size > 0 ? size : DEFAULT_PAGES_PER_CHUNK;
  const windows: PageWindow[] = [];

  for (let start = 0; start < pages.length; start += windowSize) {
    const windowPages = pages.slice(start, start + windowSize);
    const pageNumbers = windowPages.map((page) => page.pageNumber);
    windows.push({
      index: windows.length,
      pages: windowPages,
      startPage: Math.min(...pageNumbers),
      endPage: Math.max(...pageNumbers),
    });
  }

  return windows;
}

/**
 * Builds the sliced NormalizedDocument sent to the provider for one window:
 * only that window's pages, only the assets that belong to those pages
 * (plus document-level assets with no sourcePage, kept in the first window
 * only so they aren't duplicated across calls), and warnings kept only on
 * the first window for the same reason.
 */
function sliceDocumentForWindow(
  document: NormalizedDocument,
  window: PageWindow,
  isFirstWindow: boolean,
): NormalizedDocument {
  const pageNumbers = new Set(window.pages.map((page) => page.pageNumber));
  const assets = document.assets.filter((asset) =>
    asset.sourcePage === undefined
      ? isFirstWindow
      : pageNumbers.has(asset.sourcePage),
  );

  return {
    ...document,
    pages: window.pages,
    assets,
    warnings: isFirstWindow ? document.warnings : [],
  };
}

/**
 * Rewrites a section id so it stays unique across windows: the first
 * occurrence of any id is kept as-is, and only a colliding later occurrence
 * gets a "_w<n>" suffix (1-based window number), falling back to a numeric
 * suffix in the (very unlikely) case that still collides.
 */
function uniqueSectionId(
  id: string,
  seenIds: Set<string>,
  windowIndex: number,
): string {
  if (!seenIds.has(id)) {
    seenIds.add(id);
    return id;
  }

  let candidate = `${id}_w${windowIndex + 1}`;
  let suffix = 2;
  while (seenIds.has(candidate)) {
    candidate = `${id}_w${windowIndex + 1}_${suffix}`;
    suffix += 1;
  }
  seenIds.add(candidate);
  return candidate;
}

/**
 * Human-readable `statusDetail` text (F-10) for the window that is *about
 * to be* converted, given how many windows have already completed (0 before
 * the first provider call). `convertDocumentInChunks` reports progress
 * *after* each window resolves, so the window currently being converted is
 * always `windows[completedWindows]` — using the completed count directly
 * would name pages that are already done (that off-by-one is exactly what
 * this helper exists to prevent; see issue #16).
 *
 * Returns `undefined` for single-window conversions (no chunk progress
 * worth showing) and once every window has finished (the ready/failed
 * status transition clears statusDetail instead).
 */
export function chunkProgressStatusDetail(
  windows: PageWindow[],
  completedWindows: number,
  totalPages: number,
): string | undefined {
  if (windows.length <= 1) {
    return undefined;
  }

  const currentWindow = windows[completedWindows];
  if (!currentWindow) {
    return undefined;
  }

  return `Converting pages ${currentWindow.startPage}-${currentWindow.endPage} of ${totalPages}…`;
}

/** Merges warnings across windows, dropping exact duplicates while keeping order. */
function dedupeWarnings(warnings: string[]): string[] {
  return Array.from(new Set(warnings));
}

/**
 * Merges one ReviewDocument per window into a single ReviewDocument:
 * - sections are concatenated in window order, with ids de-duplicated
 *   across windows (see uniqueSectionId).
 * - title/id/sourceFileName/sourceFileType/createdAt come from the first
 *   window's result (the provider stamps these from the same source
 *   document on every call, so they're identical anyway).
 * - warnings are the union (deduped) of every window's warnings.
 * - assets are deduped by id across windows. Each provider mirrors the
 *   assets of the (window-sliced) NormalizedDocument it was given back onto
 *   its ReviewDocument (see review-document-normalizer.ts), so window 1
 *   contributes the document-level assets plus its own pages' assets, and
 *   every other window contributes only its own pages' assets — deduping
 *   by id reconstructs exactly the full original asset list.
 */
function mergeChunkResults(results: ReviewDocument[]): ReviewDocument {
  const first = results[0];
  const seenSectionIds = new Set<string>();
  const sections: ReviewSection[] = [];
  const warnings: string[] = [];

  results.forEach((result, windowIndex) => {
    for (const section of result.sections) {
      const id = uniqueSectionId(section.id, seenSectionIds, windowIndex);
      sections.push(id === section.id ? section : { ...section, id });
    }
    warnings.push(...result.warnings);
  });

  const seenAssetIds = new Set<string>();
  const assets: ReviewAsset[] = [];
  for (const result of results) {
    for (const asset of result.assets) {
      if (seenAssetIds.has(asset.id)) {
        continue;
      }
      seenAssetIds.add(asset.id);
      assets.push(asset);
    }
  }

  return {
    id: first.id,
    title: first.title,
    sourceFileName: first.sourceFileName,
    sourceFileType: first.sourceFileType,
    createdAt: first.createdAt,
    updatedAt: new Date().toISOString(),
    sections,
    assets,
    warnings: dedupeWarnings(warnings),
  };
}

export type ChunkedConvertOptions = {
  /** Overrides resolvePagesPerChunk() (mainly for tests). */
  pagesPerChunk?: number;
  /** Invoked after each window's provider.convert call resolves. */
  onChunkProgress?: (
    completed: number,
    total: number,
  ) => void | Promise<void>;
};

/**
 * Converts a (possibly large) NormalizedDocument by splitting its pages
 * into consecutive windows and calling provider.convert once per window,
 * merging the results into a single ReviewDocument (see mergeChunkResults).
 *
 * Documents that fit in a single window (pages.length <= chunk size,
 * including zero-page documents) take a fast path: provider.convert is
 * called exactly once and its result is returned unchanged, so small
 * documents behave exactly as before this feature existed.
 */
export async function convertDocumentInChunks(
  provider: ConversionProvider,
  document: NormalizedDocument,
  options: ChunkedConvertOptions = {},
): Promise<ReviewDocument> {
  const pagesPerChunk = options.pagesPerChunk ?? resolvePagesPerChunk();
  const windows = splitIntoPageWindows(document.pages, pagesPerChunk);

  if (windows.length <= 1) {
    const result = await provider.convert(document);
    await options.onChunkProgress?.(1, 1);
    return result;
  }

  const results: ReviewDocument[] = [];
  for (const window of windows) {
    const windowDocument = sliceDocumentForWindow(
      document,
      window,
      window.index === 0,
    );
    const result = await provider.convert(windowDocument);
    results.push(result);
    await options.onChunkProgress?.(window.index + 1, windows.length);
  }

  return mergeChunkResults(results);
}

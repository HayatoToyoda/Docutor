import { afterEach, describe, expect, it, vi } from "vitest";
import {
  convertDocumentInChunks,
  DEFAULT_PAGES_PER_CHUNK,
  resolvePagesPerChunk,
  splitIntoPageWindows,
} from "@/lib/llm/chunked-convert";
import type {
  ConversionProvider,
  NormalizedAsset,
  NormalizedDocument,
  NormalizedPage,
  ReviewDocument,
} from "@/lib/types";

function buildPages(count: number): NormalizedPage[] {
  return Array.from({ length: count }, (_, index) => {
    const pageNumber = index + 1;
    const pageImage: NormalizedAsset = {
      id: `asset_page_${pageNumber}`,
      kind: "page-image",
      path: `/tmp/page-${pageNumber}.png`,
      mimeType: "image/png",
      sourcePage: pageNumber,
    };
    return {
      pageNumber,
      text: `Text for page ${pageNumber}`,
      markdownTables: [],
      imagePath: pageImage.path,
      assets: [pageImage],
    };
  });
}

function buildDocument(pageCount: number): NormalizedDocument {
  const pages = buildPages(pageCount);
  const docLevelAsset: NormalizedAsset = {
    id: "asset_doc_level",
    kind: "table",
    path: "/tmp/doc-level.json",
    mimeType: "application/json",
    // No sourcePage: a document-level asset, must only appear in window 1.
  };

  return {
    id: "doc_1",
    sourceFileName: "sample.pdf",
    fileType: "pdf",
    createdAt: "2020-01-01T00:00:00.000Z",
    pages,
    assets: [docLevelAsset, ...pages.flatMap((page) => page.assets)],
    warnings: ["A warning from the python worker."],
  };
}

/**
 * Builds a stub ConversionProvider that records every NormalizedDocument it
 * was called with and returns a synthetic ReviewDocument per call. Section
 * ids are NOT unique across calls by default (mirroring the real mock
 * provider, which always returns the same ids) so tests can exercise the
 * chunked-convert de-duplication logic.
 */
function buildStubProvider(options?: {
  sectionIdsPerCall?: string[][];
}) {
  const calls: NormalizedDocument[] = [];
  let callIndex = 0;

  const provider: ConversionProvider = {
    name: "mock",
    async convert(input) {
      calls.push(input);
      const ids = options?.sectionIdsPerCall?.[callIndex] ?? [
        "sec_summary_1",
        "sec_diagram_2",
      ];
      callIndex += 1;

      const result: ReviewDocument = {
        id: input.id,
        title: `${input.sourceFileName} window ${callIndex}`,
        sourceFileName: input.sourceFileName,
        sourceFileType: input.fileType,
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2020-01-01T00:00:00.000Z",
        sections: ids.map((id) => ({
          id,
          type: "paragraph",
          title: `Section ${id}`,
          sourcePage: input.pages[0]?.pageNumber ?? 1,
          generatedMarkdown: `Markdown for ${id}`,
          reviewStatus: "pending",
        })),
        assets: input.assets.map((asset) => ({
          id: asset.id,
          path: asset.path,
          mimeType: asset.mimeType,
          title: asset.kind,
          sourcePage: asset.sourcePage,
        })),
        warnings: input.warnings,
      };
      return result;
    },
  };

  return { provider, calls };
}

describe("splitIntoPageWindows", () => {
  it("splits pages into consecutive windows of the given size", () => {
    const windows = splitIntoPageWindows(buildPages(13), 6);
    expect(windows).toHaveLength(3);
    expect(windows[0].pages.map((p) => p.pageNumber)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(windows[1].pages.map((p) => p.pageNumber)).toEqual([7, 8, 9, 10, 11, 12]);
    expect(windows[2].pages.map((p) => p.pageNumber)).toEqual([13]);
    expect(windows[0]).toMatchObject({ startPage: 1, endPage: 6 });
    expect(windows[1]).toMatchObject({ startPage: 7, endPage: 12 });
    expect(windows[2]).toMatchObject({ startPage: 13, endPage: 13 });
  });
});

describe("resolvePagesPerChunk", () => {
  const ORIGINAL_ENV = process.env.DOCUTOR_PAGES_PER_CHUNK;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.DOCUTOR_PAGES_PER_CHUNK;
    } else {
      process.env.DOCUTOR_PAGES_PER_CHUNK = ORIGINAL_ENV;
    }
  });

  it("falls back to DEFAULT_PAGES_PER_CHUNK when unset", () => {
    delete process.env.DOCUTOR_PAGES_PER_CHUNK;
    expect(resolvePagesPerChunk()).toBe(DEFAULT_PAGES_PER_CHUNK);
  });

  it("respects a valid positive override", () => {
    process.env.DOCUTOR_PAGES_PER_CHUNK = "2";
    expect(resolvePagesPerChunk()).toBe(2);
  });

  it("falls back to the default for an invalid override", () => {
    process.env.DOCUTOR_PAGES_PER_CHUNK = "not-a-number";
    expect(resolvePagesPerChunk()).toBe(DEFAULT_PAGES_PER_CHUNK);

    process.env.DOCUTOR_PAGES_PER_CHUNK = "0";
    expect(resolvePagesPerChunk()).toBe(DEFAULT_PAGES_PER_CHUNK);

    process.env.DOCUTOR_PAGES_PER_CHUNK = "-3";
    expect(resolvePagesPerChunk()).toBe(DEFAULT_PAGES_PER_CHUNK);
  });
});

describe("convertDocumentInChunks", () => {
  it("single window: calls provider.convert exactly once and returns its result unchanged", async () => {
    const document = buildDocument(5);
    const { provider, calls } = buildStubProvider();
    const onChunkProgress = vi.fn();

    const result = await convertDocumentInChunks(provider, document, {
      pagesPerChunk: 6,
      onChunkProgress,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe(document);
    expect(result.sections.map((s) => s.id)).toEqual([
      "sec_summary_1",
      "sec_diagram_2",
    ]);
    expect(onChunkProgress).toHaveBeenCalledTimes(1);
    expect(onChunkProgress).toHaveBeenCalledWith(1, 1);
  });

  it("13 pages, chunk size 6: makes 3 calls with the right page windows and window-scoped assets", async () => {
    const document = buildDocument(13);
    const { provider, calls } = buildStubProvider();

    await convertDocumentInChunks(provider, document, { pagesPerChunk: 6 });

    expect(calls).toHaveLength(3);

    expect(calls[0].pages.map((p) => p.pageNumber)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(calls[1].pages.map((p) => p.pageNumber)).toEqual([
      7, 8, 9, 10, 11, 12,
    ]);
    expect(calls[2].pages.map((p) => p.pageNumber)).toEqual([13]);

    // Window 1 keeps the document-level asset (no sourcePage) plus its own
    // pages' assets.
    expect(calls[0].assets.map((a) => a.id)).toEqual([
      "asset_doc_level",
      "asset_page_1",
      "asset_page_2",
      "asset_page_3",
      "asset_page_4",
      "asset_page_5",
      "asset_page_6",
    ]);
    // Later windows only get their own pages' assets, no document-level
    // asset and no other window's page assets.
    expect(calls[1].assets.map((a) => a.id)).toEqual([
      "asset_page_7",
      "asset_page_8",
      "asset_page_9",
      "asset_page_10",
      "asset_page_11",
      "asset_page_12",
    ]);
    expect(calls[2].assets.map((a) => a.id)).toEqual(["asset_page_13"]);

    // Warnings are only forwarded on the first window, to avoid duplication.
    expect(calls[0].warnings).toEqual(["A warning from the python worker."]);
    expect(calls[1].warnings).toEqual([]);
    expect(calls[2].warnings).toEqual([]);
  });

  it("merges sections from every window in window order", async () => {
    const document = buildDocument(13);
    const { provider } = buildStubProvider({
      sectionIdsPerCall: [
        ["sec_a_1", "sec_b_2"],
        ["sec_c_1", "sec_d_2"],
        ["sec_e_1"],
      ],
    });

    const result = await convertDocumentInChunks(provider, document, {
      pagesPerChunk: 6,
    });

    expect(result.sections.map((s) => s.id)).toEqual([
      "sec_a_1",
      "sec_b_2",
      "sec_c_1",
      "sec_d_2",
      "sec_e_1",
    ]);
  });

  it("de-duplicates colliding section ids across windows while preserving already-unique ids", async () => {
    const document = buildDocument(13);
    // The (real) mock provider always returns the same fixed ids on every
    // call, so this mirrors that: every window collides on both ids.
    const { provider } = buildStubProvider({
      sectionIdsPerCall: [
        ["sec_mock_summary_1", "sec_mock_diagram_2"],
        ["sec_mock_summary_1", "sec_mock_diagram_2"],
        ["sec_mock_summary_1", "sec_unique_only_in_window_3"],
      ],
    });

    const result = await convertDocumentInChunks(provider, document, {
      pagesPerChunk: 6,
    });

    const ids = result.sections.map((s) => s.id);
    // Window 1's ids are kept as-is (first occurrence).
    expect(ids[0]).toBe("sec_mock_summary_1");
    expect(ids[1]).toBe("sec_mock_diagram_2");
    // Window 2's colliding ids get a _w2 suffix.
    expect(ids[2]).toBe("sec_mock_summary_1_w2");
    expect(ids[3]).toBe("sec_mock_diagram_2_w2");
    // Window 3: the colliding id gets _w3, the already-unique id is kept.
    expect(ids[4]).toBe("sec_mock_summary_1_w3");
    expect(ids[5]).toBe("sec_unique_only_in_window_3");

    // Every id in the merged result is unique.
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("dedupes exact-duplicate warnings across windows and takes the title from the first window", async () => {
    const document = buildDocument(13);
    const calls: NormalizedDocument[] = [];
    let callIndex = 0;
    const provider: ConversionProvider = {
      name: "mock",
      async convert(input) {
        calls.push(input);
        callIndex += 1;
        const result: ReviewDocument = {
          id: input.id,
          title: `Window ${callIndex} title`,
          sourceFileName: input.sourceFileName,
          sourceFileType: input.fileType,
          createdAt: "2020-01-01T00:00:00.000Z",
          updatedAt: "2020-01-01T00:00:00.000Z",
          sections: [
            {
              id: `sec_${callIndex}`,
              type: "paragraph",
              title: "Section",
              sourcePage: input.pages[0]?.pageNumber ?? 1,
              generatedMarkdown: "Markdown",
              reviewStatus: "pending",
            },
          ],
          assets: [],
          warnings: [
            "A warning from the python worker.",
            "Only the first 6 page images were provided to the model.",
          ],
        };
        return result;
      },
    };

    const result = await convertDocumentInChunks(provider, document, {
      pagesPerChunk: 6,
    });

    expect(result.title).toBe("Window 1 title");
    expect(result.warnings).toEqual([
      "A warning from the python worker.",
      "Only the first 6 page images were provided to the model.",
    ]);
  });

  it("invokes onChunkProgress with (completed, total) after each window", async () => {
    const document = buildDocument(13);
    const { provider } = buildStubProvider();
    const onChunkProgress = vi.fn();

    await convertDocumentInChunks(provider, document, {
      pagesPerChunk: 6,
      onChunkProgress,
    });

    expect(onChunkProgress).toHaveBeenCalledTimes(3);
    expect(onChunkProgress).toHaveBeenNthCalledWith(1, 1, 3);
    expect(onChunkProgress).toHaveBeenNthCalledWith(2, 2, 3);
    expect(onChunkProgress).toHaveBeenNthCalledWith(3, 3, 3);
  });

  it("respects the DOCUTOR_PAGES_PER_CHUNK env override when pagesPerChunk isn't passed explicitly", async () => {
    const ORIGINAL_ENV = process.env.DOCUTOR_PAGES_PER_CHUNK;
    process.env.DOCUTOR_PAGES_PER_CHUNK = "4";

    try {
      const document = buildDocument(13);
      const { provider, calls } = buildStubProvider();

      await convertDocumentInChunks(provider, document, {});

      expect(calls).toHaveLength(4);
      expect(calls.map((call) => call.pages.length)).toEqual([4, 4, 4, 1]);
    } finally {
      if (ORIGINAL_ENV === undefined) {
        delete process.env.DOCUTOR_PAGES_PER_CHUNK;
      } else {
        process.env.DOCUTOR_PAGES_PER_CHUNK = ORIGINAL_ENV;
      }
    }
  });
});

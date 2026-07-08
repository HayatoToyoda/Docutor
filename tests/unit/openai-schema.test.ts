import { describe, expect, it } from "vitest";
import { zodTextFormat } from "openai/helpers/zod";
import {
  reviewDocumentSchema,
  type ReviewDocumentOutput,
} from "../../src/lib/llm/review-document-schema";
import {
  normalizeReviewDocument,
  normalizeReviewSection,
} from "../../src/lib/llm/review-document-normalizer";
import {
  buildDocumentConversionPrompt,
  buildSectionRegenerationPrompt,
} from "../../src/lib/llm/prompts";
import type { NormalizedDocument, ReviewSection } from "../../src/lib/types";

const modelPayload: ReviewDocumentOutput = {
  title: "Sample Document",
  sections: [
    {
      id: "sec_summary_1",
      type: "paragraph",
      title: "Summary",
      sourcePage: 1,
      originalText: "Original page text",
      generatedMarkdown: "Generated summary markdown",
      notes: null,
    },
    {
      id: "sec_diagram_2",
      type: "diagram",
      title: "Workflow",
      sourcePage: 2,
      originalText: null,
      generatedMarkdown: "```mermaid\nflowchart TD\n  A --> B\n```",
      notes: null,
      format: "mermaid",
      diagramIR: null,
      generatedCode: "flowchart TD\n  A --> B",
      drawioXml: null,
    },
  ],
  warnings: ["Unclear: some ambiguity."],
};

function buildNormalizedDocument(
  overrides: Partial<NormalizedDocument> = {},
): NormalizedDocument {
  return {
    id: "doc_1",
    sourceFileName: "sample.pdf",
    fileType: "pdf",
    createdAt: "2020-01-01T00:00:00.000Z",
    pages: [
      { pageNumber: 1, text: "page 1 text", markdownTables: [], assets: [] },
      {
        pageNumber: 2,
        text: "page 2 text",
        markdownTables: [],
        imagePath: "/var/runtime/documents/doc_1/assets/page-2.png",
        assets: [],
      },
    ],
    assets: [
      {
        id: "asset_1",
        kind: "page-image",
        path: "/var/runtime/documents/doc_1/assets/page-2.png",
        mimeType: "image/png",
        sourcePage: 2,
      },
    ],
    warnings: ["Normalizer warning."],
    ...overrides,
  };
}

describe("OpenAI review document schema", () => {
  it("can be converted to a strict structured output format", () => {
    expect(() =>
      zodTextFormat(reviewDocumentSchema, "review_document"),
    ).not.toThrow();
  });

  it("does not require document metadata (id/createdAt/updatedAt/assets/sourceFileName) on the model payload", () => {
    expect(() => reviewDocumentSchema.parse(modelPayload)).not.toThrow();
    const parsed = reviewDocumentSchema.parse(modelPayload);
    expect(parsed).not.toHaveProperty("id");
    expect(parsed).not.toHaveProperty("createdAt");
    expect(parsed).not.toHaveProperty("updatedAt");
    expect(parsed).not.toHaveProperty("assets");
    expect(parsed).not.toHaveProperty("sourceFileName");
  });

  it("does not accept reviewStatus or sourceImage on sections", () => {
    const sectionWithExtraFields = {
      ...modelPayload,
      sections: [
        {
          ...modelPayload.sections[0],
          reviewStatus: "pending",
          sourceImage: "/some/path.png",
        },
      ],
    };

    // Zod object schemas strip unknown keys by default, so parsing succeeds
    // but the extra fields never make it into the parsed output.
    const parsed = reviewDocumentSchema.parse(sectionWithExtraFields);
    expect(parsed.sections[0]).not.toHaveProperty("reviewStatus");
    expect(parsed.sections[0]).not.toHaveProperty("sourceImage");
  });
});

describe("normalizeReviewDocument", () => {
  it("stamps id/timestamps/reviewStatus/assets from the source, not the model", () => {
    const source = buildNormalizedDocument();
    const before = Date.now();
    const result = normalizeReviewDocument(modelPayload, source);
    const after = Date.now();

    expect(result.id).toBe(source.id);
    expect(result.sourceFileName).toBe(source.sourceFileName);
    expect(result.sourceFileType).toBe(source.fileType);
    expect(new Date(result.createdAt).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(result.createdAt).getTime()).toBeLessThanOrEqual(after);
    expect(result.updatedAt).toBe(result.createdAt);

    expect(result.sections.every((section) => section.reviewStatus === "pending")).toBe(
      true,
    );

    expect(result.assets).toEqual([
      {
        id: "asset_1",
        path: "/var/runtime/documents/doc_1/assets/page-2.png",
        mimeType: "image/png",
        title: "page-image",
        sourcePage: 2,
      },
    ]);

    expect(result.warnings).toEqual([
      "Normalizer warning.",
      "Unclear: some ambiguity.",
    ]);
  });

  it("resolves diagram sourceImage from the normalized page's imagePath, defaulting to empty string", () => {
    const source = buildNormalizedDocument();
    const result = normalizeReviewDocument(modelPayload, source);

    const diagramSection = result.sections.find(
      (section) => section.type === "diagram",
    );
    expect(diagramSection?.sourceImage).toBe(
      "/var/runtime/documents/doc_1/assets/page-2.png",
    );

    const noImageSource = buildNormalizedDocument({
      pages: [
        { pageNumber: 1, text: "", markdownTables: [], assets: [] },
        { pageNumber: 2, text: "", markdownTables: [], assets: [] },
      ],
    });
    const noImageResult = normalizeReviewDocument(modelPayload, noImageSource);
    const noImageDiagram = noImageResult.sections.find(
      (section) => section.type === "diagram",
    );
    expect(noImageDiagram?.sourceImage).toBe("");
  });
});

describe("normalizeReviewSection", () => {
  const sourceSection: ReviewSection = {
    id: "sec_original",
    type: "paragraph",
    title: "Original title",
    sourcePage: 3,
    originalText: "Stored original text",
    generatedMarkdown: "Stored markdown",
    reviewStatus: "pending",
  };

  it("keeps the source id/sourcePage and stamps reviewStatus to pending", () => {
    const output = modelPayload.sections[0];
    const result = normalizeReviewSection(output, sourceSection);

    expect(result.id).toBe(sourceSection.id);
    expect(result.reviewStatus).toBe("pending");
  });

  it("falls back to the source originalText when the regeneration omits it", () => {
    const output = { ...modelPayload.sections[0], originalText: null };
    const result = normalizeReviewSection(output, sourceSection);

    expect(result.originalText).toBe(sourceSection.originalText);
  });

  it("always keeps the source sourceImage for diagram sections (model never provides one)", () => {
    const diagramSource: ReviewSection = {
      id: "sec_diagram",
      type: "diagram",
      title: "Original diagram",
      sourcePage: 2,
      sourceImage: "/api/documents/doc_1/pages/2/image",
      generatedMarkdown: "```mermaid\nflowchart TD\n  A --> B\n```",
      reviewStatus: "accepted",
      format: "mermaid",
      generatedCode: "flowchart TD\n  A --> B",
    };

    const output = modelPayload.sections[1];
    const result = normalizeReviewSection(output, diagramSource);

    expect(result.type).toBe("diagram");
    if (result.type === "diagram") {
      expect(result.sourceImage).toBe(diagramSource.sourceImage);
    }
  });
});

describe("prompt building never leaks server file paths", () => {
  it("omits runtime/documents paths from the document conversion prompt even when assets have absolute paths", () => {
    const source = buildNormalizedDocument();
    const prompt = buildDocumentConversionPrompt(source);

    expect(prompt).not.toContain("runtime/documents");
    expect(prompt).not.toContain(source.assets[0].path);
    expect(prompt).not.toContain(source.pages[1].imagePath);
    expect(prompt).toContain("hasPageImage");
  });

  it("omits runtime/documents paths from the section regeneration prompt", () => {
    const source = buildNormalizedDocument();
    const section: ReviewSection = {
      id: "sec_diagram",
      type: "diagram",
      title: "Original diagram",
      sourcePage: 2,
      sourceImage: "/var/runtime/documents/doc_1/assets/page-2.png",
      generatedMarkdown: "```mermaid\nflowchart TD\n  A --> B\n```",
      reviewStatus: "accepted",
      format: "mermaid",
      generatedCode: "flowchart TD\n  A --> B",
    };

    const prompt = buildSectionRegenerationPrompt(source, section);

    expect(prompt).not.toContain("runtime/documents");
    expect(prompt).not.toContain("\"reviewStatus\"");
    expect(prompt).not.toContain("\"sourceImage\"");
  });
});

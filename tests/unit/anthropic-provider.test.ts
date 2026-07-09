import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  reviewDocumentSchema,
  reviewSectionSchema,
  type ReviewDocumentOutput,
  type ReviewSectionOutput,
} from "@/lib/llm/review-document-schema";
import {
  appendPageImageTruncationWarning,
  collectPageImages,
  MAX_PAGE_IMAGES,
} from "@/lib/llm/page-images";
import type { NormalizedAsset, NormalizedDocument, ReviewDocument } from "@/lib/types";

// Mocks the whole SDK module so no network call is ever attempted. The
// default export is `Anthropic`, a class whose instances expose
// `messages.create`; `messagesCreateMock` is what the happy-path test
// configures per-case and asserts against.
const messagesCreateMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: messagesCreateMock };
  }
  return { default: MockAnthropic };
});

// Imported after the mock is declared (vi.mock is hoisted above imports by
// vitest, so this ordering is only for readability).
import {
  AnthropicProviderError,
  createAnthropicProvider,
  REVIEW_DOCUMENT_TOOL_NAME,
  REVIEW_SECTION_TOOL_NAME,
  reviewDocumentToolInputSchema,
  reviewSectionToolInputSchema,
} from "@/lib/llm/anthropic-provider";

function buildNormalizedDocument(
  overrides: Partial<NormalizedDocument> = {},
): NormalizedDocument {
  return {
    id: "doc_1",
    sourceFileName: "sample.pdf",
    fileType: "pdf",
    createdAt: "2020-01-01T00:00:00.000Z",
    pages: [{ pageNumber: 1, text: "page 1 text", markdownTables: [], assets: [] }],
    assets: [],
    warnings: [],
    ...overrides,
  };
}

const validDocumentPayload: ReviewDocumentOutput = {
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
  ],
  warnings: [],
};

const validNonDiagramSection: ReviewSectionOutput = {
  id: "sec_summary_1",
  type: "paragraph",
  title: "Summary",
  sourcePage: 1,
  originalText: "Original page text",
  generatedMarkdown: "Generated summary markdown",
  notes: null,
};

const validDiagramSection: ReviewSectionOutput = {
  id: "sec_diagram_1",
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
};

describe("Anthropic tool input schemas agree with the zod schemas (F-5)", () => {
  it("reviewDocumentToolInputSchema is a type:object JSON Schema matching reviewDocumentSchema's top-level shape", () => {
    expect(reviewDocumentToolInputSchema.type).toBe("object");

    const schema = reviewDocumentToolInputSchema as unknown as {
      properties: Record<string, unknown>;
      required: string[];
    };
    expect(Object.keys(schema.properties).sort()).toEqual(
      ["sections", "title", "warnings"].sort(),
    );
    expect(schema.required.sort()).toEqual(["sections", "title", "warnings"].sort());
  });

  it("accepts a valid metadata-free payload when parsed through reviewDocumentSchema", () => {
    expect(() => reviewDocumentSchema.parse(validDocumentPayload)).not.toThrow();
    const parsed = reviewDocumentSchema.parse(validDocumentPayload);
    // The properties the tool schema declares are exactly what a
    // successful parse produces — this is what "the tool schema and the
    // zod schema agree" means in practice: the same set of keys round-trips
    // through both.
    const schema = reviewDocumentToolInputSchema as unknown as {
      properties: Record<string, unknown>;
    };
    expect(Object.keys(parsed).sort()).toEqual(
      Object.keys(schema.properties).sort(),
    );
  });

  it("rejects a wrong-shaped payload (missing required field) through reviewDocumentSchema", () => {
    const malformed = { title: "Missing sections and warnings" };
    expect(() => reviewDocumentSchema.parse(malformed)).toThrow();
  });

  it("rejects a wrong-shaped payload (wrong type for a required field) through reviewDocumentSchema", () => {
    const malformed = { ...validDocumentPayload, sections: "not-an-array" };
    expect(() => reviewDocumentSchema.parse(malformed)).toThrow();
  });

  it("reviewSectionToolInputSchema is a type:object anyOf JSON Schema (union of the two section shapes)", () => {
    expect(reviewSectionToolInputSchema.type).toBe("object");
    const schema = reviewSectionToolInputSchema as unknown as {
      anyOf: Array<{ required: string[] }>;
    };
    expect(schema.anyOf).toHaveLength(2);
    // One branch is the non-diagram shape, the other the diagram shape —
    // only the diagram branch requires "format"/"generatedCode".
    const requiredSets = schema.anyOf.map((branch) => branch.required.sort());
    expect(requiredSets.some((required) => required.includes("format"))).toBe(
      true,
    );
    expect(
      requiredSets.some((required) => !required.includes("format")),
    ).toBe(true);
  });

  it("accepts both valid section shapes (non-diagram and diagram) through reviewSectionSchema", () => {
    expect(() => reviewSectionSchema.parse(validNonDiagramSection)).not.toThrow();
    expect(() => reviewSectionSchema.parse(validDiagramSection)).not.toThrow();
  });

  it("rejects a wrong-shaped section (diagram missing generatedCode) through reviewSectionSchema", () => {
    const malformed = { ...validDiagramSection } as Record<string, unknown>;
    delete malformed.generatedCode;
    expect(() => reviewSectionSchema.parse(malformed)).toThrow();
  });

  it("rejects a section with an invalid enum value through reviewSectionSchema", () => {
    const malformed = { ...validNonDiagramSection, type: "not-a-real-type" };
    expect(() => reviewSectionSchema.parse(malformed)).toThrow();
  });
});

describe("collectPageImages truncation (shared page-image helper)", () => {
  function buildPageImageAsset(index: number): NormalizedAsset {
    return {
      id: `asset_${index}`,
      kind: "page-image",
      path: `/var/runtime/documents/doc_1/assets/page-${index}.png`,
      mimeType: "image/png",
      sourcePage: index,
    };
  }

  it("caps page images at MAX_PAGE_IMAGES and reports the truncated count", () => {
    const assets = Array.from({ length: MAX_PAGE_IMAGES + 2 }, (_, i) =>
      buildPageImageAsset(i + 1),
    );
    const document = buildNormalizedDocument({ assets });

    const { pageImages, truncatedPageImageCount } = collectPageImages(document);

    expect(pageImages).toHaveLength(MAX_PAGE_IMAGES);
    expect(truncatedPageImageCount).toBe(2);
  });

  it("reports zero truncation when at or under the cap", () => {
    const assets = Array.from({ length: MAX_PAGE_IMAGES }, (_, i) =>
      buildPageImageAsset(i + 1),
    );
    const document = buildNormalizedDocument({ assets });

    const { pageImages, truncatedPageImageCount } = collectPageImages(document);

    expect(pageImages).toHaveLength(MAX_PAGE_IMAGES);
    expect(truncatedPageImageCount).toBe(0);
  });

  it("ignores non-page-image assets when counting", () => {
    const document = buildNormalizedDocument({
      assets: [
        { id: "a1", kind: "embedded-image", path: "/x", mimeType: "image/png" },
        { id: "a2", kind: "table", path: "/y", mimeType: "text/csv" },
      ],
    });

    const { pageImages, truncatedPageImageCount } = collectPageImages(document);

    expect(pageImages).toHaveLength(0);
    expect(truncatedPageImageCount).toBe(0);
  });

  it("appendPageImageTruncationWarning only appends a warning when something was truncated", () => {
    const base: ReviewDocument = {
      id: "doc_1",
      title: "Doc",
      sourceFileName: "sample.pdf",
      sourceFileType: "pdf",
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z",
      sections: [],
      assets: [],
      warnings: ["existing warning"],
    };

    const untouched = appendPageImageTruncationWarning(base, 0);
    expect(untouched.warnings).toEqual(["existing warning"]);

    const warned = appendPageImageTruncationWarning(base, 3);
    expect(warned.warnings).toHaveLength(2);
    expect(warned.warnings.at(-1)).toContain(String(MAX_PAGE_IMAGES));
  });
});

describe("createAnthropicProvider().convert without ANTHROPIC_API_KEY", () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    messagesCreateMock.mockReset();
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
  });

  it("rejects with a clear AnthropicProviderError instead of calling the SDK", async () => {
    const provider = createAnthropicProvider();
    const document = buildNormalizedDocument();

    await expect(provider.convert(document)).rejects.toThrow(
      AnthropicProviderError,
    );
    await expect(provider.convert(document)).rejects.toThrow(
      "ANTHROPIC_API_KEY is required for the Anthropic conversion provider.",
    );
    expect(messagesCreateMock).not.toHaveBeenCalled();
  });

  it("also rejects regenerateSection with the same clear error", async () => {
    const provider = createAnthropicProvider();
    const document = buildNormalizedDocument();
    const section = {
      id: "sec_1",
      type: "paragraph" as const,
      title: "Section",
      sourcePage: 1,
      generatedMarkdown: "content",
      reviewStatus: "pending" as const,
    };

    await expect(
      provider.regenerateSection?.(document, section),
    ).rejects.toThrow("ANTHROPIC_API_KEY is required for the Anthropic conversion provider.");
  });
});

describe("createAnthropicProvider().convert happy path (mocked SDK)", () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    messagesCreateMock.mockReset();
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    }
  });

  it("forces the submit_review_document tool via tool_choice and normalizes the tool_use input", async () => {
    messagesCreateMock.mockResolvedValue({
      id: "msg_1",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-5",
      stop_reason: "tool_use",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
      content: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: REVIEW_DOCUMENT_TOOL_NAME,
          input: validDocumentPayload,
        },
      ],
    });

    const provider = createAnthropicProvider();
    const document = buildNormalizedDocument();
    const result = await provider.convert(document);

    expect(messagesCreateMock).toHaveBeenCalledTimes(1);
    const callArgs = messagesCreateMock.mock.calls[0][0];
    expect(callArgs.tool_choice).toEqual({
      type: "tool",
      name: REVIEW_DOCUMENT_TOOL_NAME,
    });
    expect(callArgs.tools).toHaveLength(1);
    expect(callArgs.tools[0].name).toBe(REVIEW_DOCUMENT_TOOL_NAME);
    expect(callArgs.system).toBeTruthy();

    // The tool_use input flowed through reviewDocumentSchema.parse and
    // normalizeReviewDocument: server-stamped metadata is present, and the
    // model-authored content matches what the mock returned.
    expect(result.id).toBe(document.id);
    expect(result.title).toBe(validDocumentPayload.title);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].reviewStatus).toBe("pending");
  });

  it("throws AnthropicProviderError when no matching tool_use block is returned", async () => {
    messagesCreateMock.mockResolvedValue({
      id: "msg_2",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-5",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
      content: [{ type: "text", text: "I could not comply." }],
    });

    const provider = createAnthropicProvider();
    await expect(provider.convert(buildNormalizedDocument())).rejects.toThrow(
      AnthropicProviderError,
    );
  });

  it("forces the submit_review_section tool for regenerateSection", async () => {
    messagesCreateMock.mockResolvedValue({
      id: "msg_3",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-5",
      stop_reason: "tool_use",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
      content: [
        {
          type: "tool_use",
          id: "toolu_2",
          name: REVIEW_SECTION_TOOL_NAME,
          input: validNonDiagramSection,
        },
      ],
    });

    const provider = createAnthropicProvider();
    const document = buildNormalizedDocument();
    const section = {
      id: "sec_summary_1",
      type: "paragraph" as const,
      title: "Old title",
      sourcePage: 1,
      generatedMarkdown: "Old content",
      reviewStatus: "accepted" as const,
    };

    const result = await provider.regenerateSection?.(document, section, {
      instruction: "Fix the wording",
    });

    const callArgs = messagesCreateMock.mock.calls[0][0];
    expect(callArgs.tool_choice).toEqual({
      type: "tool",
      name: REVIEW_SECTION_TOOL_NAME,
    });
    expect(result?.id).toBe(section.id);
    expect(result?.reviewStatus).toBe("pending");
  });
});

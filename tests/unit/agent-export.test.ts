import { describe, expect, it } from "vitest";
import {
  buildAgentDocumentJson,
  buildAgentSectionsJsonl,
} from "../../src/lib/document-model";
import { reviewDocumentFixture } from "../fixtures/review-document";
import type {
  DiagramSection,
  ReviewDocument,
  StoredDocumentJob,
} from "../../src/lib/types";

const diagramSection: DiagramSection = {
  id: "sec_diagram_1",
  type: "diagram",
  title: "Workflow diagram",
  sourcePage: 3,
  sourceImage: "",
  format: "mermaid",
  generatedCode: "flowchart TD\n  A --> B",
  generatedMarkdown: "```mermaid\nflowchart TD\n  A --> B\n```",
  reviewStatus: "accepted",
  notes: ["[instruction] fix the arrow direction"],
};

const drawioSection: DiagramSection = {
  id: "sec_diagram_2",
  type: "diagram",
  title: "Complex workflow diagram",
  sourcePage: 4,
  sourceImage: "",
  format: "drawio",
  generatedCode: "",
  drawioXml: "<mxGraphModel></mxGraphModel>",
  generatedMarkdown: "See attached draw.io diagram.",
  reviewStatus: "accepted",
};

describe("buildAgentSectionsJsonl", () => {
  it("includes only accepted sections, one JSON object per line", () => {
    const jsonl = buildAgentSectionsJsonl(reviewDocumentFixture);
    const lines = jsonl.trim().split("\n");

    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0]);
    expect(record.id).toBe("sec_requirement_1");
    expect(record.reviewStatus).toBe("accepted");
  });

  it("parses each line as JSON with the expected fields and key order", () => {
    const document: ReviewDocument = {
      ...reviewDocumentFixture,
      sections: [
        {
          id: "sec_text_1",
          type: "paragraph",
          title: "Summary",
          sourcePage: 1,
          generatedMarkdown: "Some accepted paragraph text.",
          reviewStatus: "accepted",
        },
      ],
    };

    const jsonl = buildAgentSectionsJsonl(document);
    const lines = jsonl.trim().split("\n");
    expect(lines).toHaveLength(1);

    const record = JSON.parse(lines[0]);
    expect(record).toEqual({
      id: "sec_text_1",
      type: "paragraph",
      title: "Summary",
      sourceFile: document.sourceFileName,
      sourcePage: 1,
      markdown: "Some accepted paragraph text.",
      reviewStatus: "accepted",
    });
    // Deterministic key order.
    expect(Object.keys(record)).toEqual([
      "id",
      "type",
      "title",
      "sourceFile",
      "sourcePage",
      "markdown",
      "reviewStatus",
    ]);
  });

  it("carries mermaid (fence-stripped) and the fenced markdown for a mermaid diagram section, plus notes", () => {
    const document: ReviewDocument = {
      ...reviewDocumentFixture,
      sections: [diagramSection],
    };

    const jsonl = buildAgentSectionsJsonl(document);
    const record = JSON.parse(jsonl.trim());

    expect(record.mermaid).toBe("flowchart TD\n  A --> B");
    expect(record.markdown).toBe(
      "```mermaid\nflowchart TD\n  A --> B\n```",
    );
    expect(record.notes).toEqual(["[instruction] fix the arrow direction"]);
    expect(record.drawioXml).toBeUndefined();
    expect(Object.keys(record)).toEqual([
      "id",
      "type",
      "title",
      "sourceFile",
      "sourcePage",
      "markdown",
      "reviewStatus",
      "notes",
      "mermaid",
    ]);
  });

  it("carries drawioXml for a drawio diagram section and omits mermaid", () => {
    const document: ReviewDocument = {
      ...reviewDocumentFixture,
      sections: [drawioSection],
    };

    const jsonl = buildAgentSectionsJsonl(document);
    const record = JSON.parse(jsonl.trim());

    expect(record.drawioXml).toBe("<mxGraphModel></mxGraphModel>");
    expect(record.mermaid).toBeUndefined();
    expect(record.markdown).toBe("See attached draw.io diagram.");
  });

  it("omits notes when a section has none", () => {
    const jsonl = buildAgentSectionsJsonl(reviewDocumentFixture);
    const record = JSON.parse(jsonl.trim());
    expect("notes" in record).toBe(false);
  });

  it("returns an empty string when there are no accepted sections", () => {
    const document: ReviewDocument = {
      ...reviewDocumentFixture,
      sections: reviewDocumentFixture.sections.map((section) => ({
        ...section,
        reviewStatus: "pending",
      })),
    };

    expect(buildAgentSectionsJsonl(document)).toBe("");
  });
});

function buildJob(overrides: Partial<StoredDocumentJob> = {}): StoredDocumentJob {
  return {
    id: "doc_fixture",
    status: "ready",
    sourceFileName: "fixture.pdf",
    sourceFileType: "pdf",
    mimeType: "application/pdf",
    size: 1024,
    createdAt: reviewDocumentFixture.createdAt,
    updatedAt: reviewDocumentFixture.updatedAt,
    originalPath: "",
    reviewDocument: reviewDocumentFixture,
    ...overrides,
  };
}

describe("buildAgentDocumentJson", () => {
  it("builds document metadata with section order and accepted ids", () => {
    const metadata = buildAgentDocumentJson(buildJob());

    expect(metadata.id).toBe("doc_fixture");
    expect(metadata.title).toBe(reviewDocumentFixture.title);
    expect(metadata.sourceFileName).toBe("fixture.pdf");
    expect(metadata.sourceFileType).toBe("pdf");
    expect(metadata.convertedAt).toBe(reviewDocumentFixture.createdAt);
    expect(typeof metadata.exportedAt).toBe("string");
    expect(metadata.warnings).toEqual(reviewDocumentFixture.warnings);
    expect(metadata.sectionOrder).toEqual([
      "sec_requirement_1",
      "sec_pending_2",
    ]);
    expect(metadata.acceptedSectionIds).toEqual(["sec_requirement_1"]);
  });

  it("throws when the job has no review document", () => {
    expect(() =>
      buildAgentDocumentJson(buildJob({ reviewDocument: undefined })),
    ).toThrow();
  });
});

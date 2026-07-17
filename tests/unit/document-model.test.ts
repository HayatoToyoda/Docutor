import { describe, expect, it } from "vitest";
import {
  applySectionPatch,
  buildExportManifest,
  collectDiagramExports,
  sanitizeSectionPatch,
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
  sourcePage: 1,
  sourceImage: "",
  format: "mermaid",
  generatedCode: "flowchart TD\n  A --> B",
  generatedMarkdown: "```mermaid\nflowchart TD\n  A --> STALE\n```",
  reviewStatus: "pending",
};

const drawioSection: DiagramSection = {
  id: "sec_diagram_2",
  type: "diagram",
  title: "Complex workflow diagram",
  sourcePage: 2,
  sourceImage: "",
  format: "drawio",
  generatedCode: "",
  generatedMarkdown: "See attached draw.io diagram.",
  drawioXml: "<mxGraphModel></mxGraphModel>",
  reviewStatus: "accepted",
};

describe("applySectionPatch", () => {
  it("patches the target section and refreshes updatedAt without mutating the input", () => {
    const before = reviewDocumentFixture.sections[1].reviewStatus;
    const updated = applySectionPatch(
      reviewDocumentFixture,
      "sec_pending_2",
      { reviewStatus: "accepted" },
    );

    expect(before).toBe("pending");
    expect(reviewDocumentFixture.sections[1].reviewStatus).toBe("pending");
    expect(updated.sections[1].reviewStatus).toBe("accepted");
    expect(updated.updatedAt).not.toBe(reviewDocumentFixture.updatedAt);
    expect(updated).not.toBe(reviewDocumentFixture);
  });

  it("leaves other sections untouched", () => {
    const updated = applySectionPatch(
      reviewDocumentFixture,
      "sec_pending_2",
      { reviewStatus: "rejected" },
    );

    expect(updated.sections[0]).toBe(reviewDocumentFixture.sections[0]);
  });

  it("syncs generatedMarkdown to a mermaid fence of generatedCode for mermaid diagram sections", () => {
    const document: ReviewDocument = {
      ...reviewDocumentFixture,
      sections: [diagramSection],
    };

    const updated = applySectionPatch(document, diagramSection.id, {
      generatedCode: "flowchart TD\n  A --> C",
    });

    const section = updated.sections[0] as DiagramSection;
    expect(section.generatedCode).toBe("flowchart TD\n  A --> C");
    expect(section.generatedMarkdown).toBe(
      "```mermaid\nflowchart TD\n  A --> C\n```",
    );
  });

  it("does not touch generatedMarkdown for mermaid diagrams when the patch omits generatedCode", () => {
    const document: ReviewDocument = {
      ...reviewDocumentFixture,
      sections: [diagramSection],
    };

    const updated = applySectionPatch(document, diagramSection.id, {
      reviewStatus: "accepted",
    });

    const section = updated.sections[0] as DiagramSection;
    expect(section.generatedMarkdown).toBe(diagramSection.generatedMarkdown);
    expect(section.reviewStatus).toBe("accepted");
  });

  it("does not sync generatedMarkdown for non-mermaid (drawio) diagram sections", () => {
    const document: ReviewDocument = {
      ...reviewDocumentFixture,
      sections: [drawioSection],
    };

    const updated = applySectionPatch(document, drawioSection.id, {
      generatedCode: "ignored for drawio",
    });

    const section = updated.sections[0] as DiagramSection;
    expect(section.generatedMarkdown).toBe(drawioSection.generatedMarkdown);
  });

  it("passes non-diagram section patches through unchanged", () => {
    const updated = applySectionPatch(
      reviewDocumentFixture,
      "sec_requirement_1",
      { generatedMarkdown: "- Updated requirement text." },
    );

    expect(updated.sections[0].generatedMarkdown).toBe(
      "- Updated requirement text.",
    );
  });
});

// Regression for issue #19: the PATCH route used to cast the raw request
// body to SectionPatch and spread it onto the stored section, letting a
// hand-crafted request overwrite server-owned fields (id/type/sourceImage…)
// or store an invalid reviewStatus.
describe("sanitizeSectionPatch", () => {
  it("passes through a full valid patch", () => {
    const patch = sanitizeSectionPatch({
      generatedMarkdown: "New markdown",
      generatedCode: "flowchart TD\n  A --> B",
      drawioXml: "<mxGraphModel/>",
      reviewStatus: "accepted",
      notes: ["a note"],
    });

    expect(patch).toEqual({
      generatedMarkdown: "New markdown",
      generatedCode: "flowchart TD\n  A --> B",
      drawioXml: "<mxGraphModel/>",
      reviewStatus: "accepted",
      notes: ["a note"],
    });
  });

  it("drops unknown keys (server-owned fields cannot be overwritten)", () => {
    const patch = sanitizeSectionPatch({
      reviewStatus: "rejected",
      id: "sec_hijacked",
      type: "paragraph",
      sourcePage: 99,
      sourceImage: "data:image/png;base64,xxxx",
      title: "New title",
    });

    expect(patch).toEqual({ reviewStatus: "rejected" });
  });

  it("accepts an empty object as a no-op patch", () => {
    expect(sanitizeSectionPatch({})).toEqual({});
  });

  it("rejects wrong-typed known fields", () => {
    expect(sanitizeSectionPatch({ generatedMarkdown: 5 })).toBeNull();
    expect(sanitizeSectionPatch({ generatedCode: null })).toBeNull();
    expect(sanitizeSectionPatch({ drawioXml: {} })).toBeNull();
    expect(sanitizeSectionPatch({ notes: "not-an-array" })).toBeNull();
    expect(sanitizeSectionPatch({ notes: ["ok", 42] })).toBeNull();
  });

  it("rejects an invalid reviewStatus value", () => {
    expect(sanitizeSectionPatch({ reviewStatus: "bogus" })).toBeNull();
    expect(sanitizeSectionPatch({ reviewStatus: 1 })).toBeNull();
  });

  it("rejects non-object bodies", () => {
    expect(sanitizeSectionPatch(null)).toBeNull();
    expect(sanitizeSectionPatch("string")).toBeNull();
    expect(sanitizeSectionPatch(42)).toBeNull();
    expect(sanitizeSectionPatch([{ reviewStatus: "accepted" }])).toBeNull();
  });

  it("produces patches applySectionPatch accepts", () => {
    const patch = sanitizeSectionPatch({
      generatedMarkdown: "- Sanitized requirement text.",
      ignoredKey: "ignored",
    });

    expect(patch).not.toBeNull();
    const updated = applySectionPatch(
      reviewDocumentFixture,
      "sec_requirement_1",
      patch!,
    );
    expect(updated.sections[0].generatedMarkdown).toBe(
      "- Sanitized requirement text.",
    );
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

describe("buildExportManifest", () => {
  it("includes only accepted section ids and omits assets when there are none", () => {
    const manifest = buildExportManifest(buildJob());

    expect(manifest.id).toBe("doc_fixture");
    expect(manifest.sourceFileName).toBe("fixture.pdf");
    expect(manifest.sourceFileType).toBe("pdf");
    expect(manifest.acceptedSectionIds).toEqual(["sec_requirement_1"]);
    expect(manifest.assets).toBeUndefined();
    expect(typeof manifest.exportedAt).toBe("string");
    expect("status" in manifest).toBe(false);
  });

  it("includes assets when the review document has them", () => {
    const job = buildJob({
      reviewDocument: {
        ...reviewDocumentFixture,
        assets: [
          {
            id: "asset_1",
            path: "/runtime/documents/doc_fixture/page-1.png",
            mimeType: "image/png",
            title: "Page 1",
          },
        ],
      },
    });

    const manifest = buildExportManifest(job);
    expect(manifest.assets).toHaveLength(1);
    expect(manifest.assets?.[0].id).toBe("asset_1");
  });

  it("throws when the job has no review document", () => {
    expect(() =>
      buildExportManifest(buildJob({ reviewDocument: undefined })),
    ).toThrow();
  });
});

describe("collectDiagramExports", () => {
  it("collects fence-stripped mermaid source and drawio XML for diagram sections", () => {
    const document: ReviewDocument = {
      ...reviewDocumentFixture,
      sections: [diagramSection, drawioSection],
    };

    const files = collectDiagramExports(document);

    expect(files).toContainEqual({
      path: "diagrams/sec_diagram_1.mmd",
      content: "flowchart TD\n  A --> B",
    });
    expect(files).toContainEqual({
      path: "diagrams/sec_diagram_2.drawio",
      content: "<mxGraphModel></mxGraphModel>",
    });
  });

  it("skips mermaid sections with empty generatedCode and diagrams without drawioXml", () => {
    const document: ReviewDocument = {
      ...reviewDocumentFixture,
      sections: [
        { ...diagramSection, generatedCode: "" },
        { ...drawioSection, drawioXml: undefined },
      ],
    };

    expect(collectDiagramExports(document)).toEqual([]);
  });

  it("ignores non-diagram sections", () => {
    expect(collectDiagramExports(reviewDocumentFixture)).toEqual([]);
  });
});

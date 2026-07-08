import { describe, expect, it } from "vitest";
import { renderReviewDocumentMarkdown } from "../../src/lib/export/markdown";
import { reviewDocumentFixture } from "../fixtures/review-document";
import type { ReviewDocument } from "../../src/lib/types";

describe("renderReviewDocumentMarkdown", () => {
  it("exports accepted sections and omits pending sections", () => {
    const markdown = renderReviewDocumentMarkdown(reviewDocumentFixture);

    expect(markdown).toContain("# Fixture Review Document");
    expect(markdown).toContain("Approval requirement");
    expect(markdown).toContain("Orders above 1,000,000 JPY");
    expect(markdown).not.toContain("Pending note");
  });

  it("exports the edited diagram code even when generatedMarkdown is stale", () => {
    const document: ReviewDocument = {
      ...reviewDocumentFixture,
      sections: [
        {
          id: "sec_diagram_1",
          type: "diagram",
          title: "Workflow diagram",
          sourcePage: 1,
          sourceImage: "",
          format: "mermaid",
          generatedCode: "flowchart TD\n  A --> C",
          generatedMarkdown: "```mermaid\nflowchart TD\n  A --> B\n```",
          reviewStatus: "accepted",
        },
      ],
    };

    const markdown = renderReviewDocumentMarkdown(document);

    expect(markdown).toContain("A --> C");
    expect(markdown).not.toContain("A --> B");
  });

  it("exports the drawio generatedMarkdown when present, instead of the TODO placeholder", () => {
    const document: ReviewDocument = {
      ...reviewDocumentFixture,
      sections: [
        {
          id: "sec_diagram_2",
          type: "diagram",
          title: "Complex workflow diagram",
          sourcePage: 1,
          sourceImage: "",
          format: "drawio",
          generatedCode: "",
          drawioXml: "<mxGraphModel />",
          generatedMarkdown: "![drawio diagram](diagrams/sec_diagram_2.drawio)",
          reviewStatus: "accepted",
        },
      ],
    };

    const markdown = renderReviewDocumentMarkdown(document);

    expect(markdown).toContain("![drawio diagram](diagrams/sec_diagram_2.drawio)");
    expect(markdown).not.toContain(
      "TODO: draw.io diagram exported as related asset.",
    );
  });

  it("falls back to the TODO placeholder for a drawio section with no generatedMarkdown", () => {
    const document: ReviewDocument = {
      ...reviewDocumentFixture,
      sections: [
        {
          id: "sec_diagram_3",
          type: "diagram",
          title: "Complex workflow diagram",
          sourcePage: 1,
          sourceImage: "",
          format: "drawio",
          generatedCode: "",
          drawioXml: "<mxGraphModel />",
          generatedMarkdown: "",
          reviewStatus: "accepted",
        },
      ],
    };

    const markdown = renderReviewDocumentMarkdown(document);

    expect(markdown).toContain(
      "TODO: draw.io diagram exported as related asset.",
    );
  });
});

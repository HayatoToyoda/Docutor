import { describe, expect, it } from "vitest";
import { renderReviewDocumentMarkdown } from "../../src/lib/export/markdown";
import { reviewDocumentFixture } from "../fixtures/review-document";

describe("renderReviewDocumentMarkdown", () => {
  it("exports accepted sections and omits pending sections", () => {
    const markdown = renderReviewDocumentMarkdown(reviewDocumentFixture);

    expect(markdown).toContain("# Fixture Review Document");
    expect(markdown).toContain("Approval requirement");
    expect(markdown).toContain("Orders above 1,000,000 JPY");
    expect(markdown).not.toContain("Pending note");
  });
});

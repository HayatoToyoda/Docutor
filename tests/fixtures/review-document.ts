import type { ReviewDocument } from "../../src/lib/types";

export const reviewDocumentFixture: ReviewDocument = {
  id: "doc_fixture",
  title: "Fixture Review Document",
  sourceFileName: "fixture.pdf",
  sourceFileType: "pdf",
  createdAt: "2026-07-05T00:00:00.000Z",
  updatedAt: "2026-07-05T00:00:00.000Z",
  sections: [
    {
      id: "sec_requirement_1",
      type: "requirement",
      title: "Approval requirement",
      sourcePage: 1,
      generatedMarkdown:
        "- Business rule: Orders above 1,000,000 JPY require manager approval.",
      reviewStatus: "accepted",
    },
    {
      id: "sec_pending_2",
      type: "note",
      title: "Pending note",
      sourcePage: 2,
      generatedMarkdown: "TODO: Confirm exception handling.",
      reviewStatus: "pending",
    },
  ],
  assets: [],
  warnings: ["Unclear: source diagram grouping was ambiguous."],
};

import { describe, expect, it } from "vitest";
import {
  countAttentionMarkers,
  extractAttentionMarkers,
  extractSectionAttentionMarkers,
} from "../../src/lib/attention";
import type { ReviewDocument, ReviewSection } from "../../src/lib/types";

function section(overrides: Partial<ReviewSection> = {}): ReviewSection {
  return {
    id: "sec_1",
    type: "paragraph",
    title: "Section one",
    sourcePage: 1,
    generatedMarkdown: "Nothing to see here.",
    reviewStatus: "pending",
    ...overrides,
  } as ReviewSection;
}

function document(sections: ReviewSection[]): ReviewDocument {
  return {
    id: "doc_1",
    title: "Doc",
    sourceFileName: "doc.pdf",
    sourceFileType: "pdf",
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z",
    sections,
    assets: [],
    warnings: [],
  };
}

describe("extractAttentionMarkers", () => {
  it("finds a TODO marker in generated markdown", () => {
    const markers = extractAttentionMarkers(
      document([
        section({
          generatedMarkdown: "Some text.\nTODO: confirm this figure.",
        }),
      ]),
    );

    expect(markers).toEqual([
      {
        sectionId: "sec_1",
        sectionTitle: "Section one",
        marker: "TODO",
        line: "TODO: confirm this figure.",
      },
    ]);
  });

  it("finds an Unclear marker in section notes", () => {
    const markers = extractAttentionMarkers(
      document([
        section({
          notes: ["Reviewer left a note.", "Unclear: which team owns this?"],
        }),
      ]),
    );

    expect(markers).toEqual([
      {
        sectionId: "sec_1",
        sectionTitle: "Section one",
        marker: "Unclear",
        line: "Unclear: which team owns this?",
      },
    ]);
  });

  it("counts a line with both markers once per marker type", () => {
    const markers = extractSectionAttentionMarkers(
      section({
        generatedMarkdown: "TODO: fix this. Unclear: also this.",
      }),
    );

    expect(markers).toHaveLength(2);
    expect(markers.map((marker) => marker.marker).sort()).toEqual([
      "TODO",
      "Unclear",
    ]);
    expect(markers.every((marker) => marker.line === "TODO: fix this. Unclear: also this.")).toBe(
      true,
    );
  });

  it("finds multiple markers across multiple sections, preserving section order", () => {
    const markers = extractAttentionMarkers(
      document([
        section({
          id: "sec_a",
          title: "A",
          generatedMarkdown: "TODO: first.\nTODO: second.",
        }),
        section({
          id: "sec_b",
          title: "B",
          generatedMarkdown: "Unclear: third.",
        }),
      ]),
    );

    expect(markers.map((marker) => marker.sectionId)).toEqual([
      "sec_a",
      "sec_a",
      "sec_b",
    ]);
    expect(markers.map((marker) => marker.line)).toEqual([
      "TODO: first.",
      "TODO: second.",
      "Unclear: third.",
    ]);
  });

  it("returns no markers when none are present", () => {
    const markers = extractAttentionMarkers(
      document([section(), section({ id: "sec_2", title: "Section two" })]),
    );

    expect(markers).toEqual([]);
  });
});

describe("countAttentionMarkers", () => {
  it("derives the total count from extractAttentionMarkers", () => {
    const doc = document([
      section({
        generatedMarkdown: "TODO: one.\nUnclear: two.",
        notes: ["TODO: three."],
      }),
      section({ id: "sec_2", title: "Section two" }),
    ]);

    expect(countAttentionMarkers(doc)).toBe(extractAttentionMarkers(doc).length);
    expect(countAttentionMarkers(doc)).toBe(3);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildClientExport,
  createDemoDocument,
  patchClientSection,
} from "../../src/lib/client-document-store";

describe("client document store", () => {
  it("creates a reviewable demo document", () => {
    const job = createDemoDocument({
      name: "sample.pdf",
      type: "application/pdf",
      size: 1024,
    });

    expect(job.id).toMatch(/^demo-/);
    expect(job.reviewDocument?.sections).toHaveLength(3);
    expect(job.reviewDocument?.sections[2].type).toBe("diagram");
  });

  it("patches a review section without mutating the source job", () => {
    const job = createDemoDocument({
      name: "sample.pdf",
      type: "application/pdf",
      size: 1024,
    });
    const sectionId = job.reviewDocument!.sections[0].id;
    const updated = patchClientSection(job, sectionId, {
      reviewStatus: "accepted",
    });

    expect(job.reviewDocument?.sections[0].reviewStatus).toBe("pending");
    expect(updated.reviewDocument?.sections[0].reviewStatus).toBe("accepted");
  });

  it("builds a browser-side Markdown export", async () => {
    const job = createDemoDocument({
      name: "sample.pdf",
      type: "application/pdf",
      size: 1024,
    });
    const accepted = patchClientSection(
      job,
      job.reviewDocument!.sections[0].id,
      { reviewStatus: "accepted" },
    );
    const result = await buildClientExport(accepted, "markdown");

    expect(result.fileName).toBe("document.md");
    expect(await result.blob.text()).toContain("Document summary");
  });
});

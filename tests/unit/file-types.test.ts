import { describe, expect, it } from "vitest";
import { detectSourceFileType } from "../../src/lib/file-types";

describe("detectSourceFileType", () => {
  it("detects supported extensions", () => {
    expect(detectSourceFileType("spec.pdf")).toBe("pdf");
    expect(detectSourceFileType("workflow.docx")).toBe("docx");
    expect(detectSourceFileType("slides.pptx")).toBe("pptx");
  });

  it("detects supported MIME types", () => {
    expect(detectSourceFileType("file", "application/pdf")).toBe("pdf");
    expect(
      detectSourceFileType(
        "file",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("docx");
  });

  it("rejects unsupported files", () => {
    expect(detectSourceFileType("notes.txt")).toBeNull();
  });
});

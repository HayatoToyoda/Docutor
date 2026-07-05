import { describe, expect, it } from "vitest";
import {
  detectSourceFileType,
  sourceFileExtension,
} from "../../src/lib/file-types";

describe("detectSourceFileType", () => {
  it("detects supported extensions", () => {
    expect(detectSourceFileType("spec.pdf")).toBe("pdf");
    expect(detectSourceFileType("workflow.docx")).toBe("docx");
    expect(detectSourceFileType("slides.pptx")).toBe("pptx");
    expect(detectSourceFileType("diagram.png")).toBe("image");
    expect(detectSourceFileType("photo.jpg")).toBe("image");
    expect(detectSourceFileType("photo.jpeg")).toBe("image");
  });

  it("detects supported MIME types", () => {
    expect(detectSourceFileType("file", "application/pdf")).toBe("pdf");
    expect(
      detectSourceFileType(
        "file",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("docx");
    expect(detectSourceFileType("file", "image/png")).toBe("image");
    expect(detectSourceFileType("file", "image/jpeg")).toBe("image");
  });

  it("rejects unsupported files", () => {
    expect(detectSourceFileType("notes.txt")).toBeNull();
  });
});

describe("sourceFileExtension", () => {
  it("preserves the original extension regardless of file type", () => {
    expect(sourceFileExtension("spec.PDF")).toBe(".pdf");
    expect(sourceFileExtension("photo.JPG")).toBe(".jpg");
    expect(sourceFileExtension("diagram.png")).toBe(".png");
  });
});

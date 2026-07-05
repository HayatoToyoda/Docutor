import type { ConversionProvider, ReviewDocument } from "@/lib/types";

export function createMockProvider(): ConversionProvider {
  return {
    name: "mock",
    async convert(input) {
      const now = new Date().toISOString();
      const firstPage = input.pages[0];

      const document: ReviewDocument = {
        id: input.id,
        title: `${input.sourceFileName} conversion`,
        sourceFileName: input.sourceFileName,
        sourceFileType: input.fileType,
        createdAt: now,
        updatedAt: now,
        sections: [
          {
            id: "sec_mock_summary_1",
            type: "paragraph",
            title: "Mock conversion summary",
            sourcePage: firstPage?.pageNumber ?? 1,
            originalText: firstPage?.text,
            generatedMarkdown:
              firstPage?.text ||
              "TODO: No text was extracted from the source document.",
            reviewStatus: "pending",
          },
        ],
        assets: input.assets.map((asset) => ({
          id: asset.id,
          path: asset.path,
          mimeType: asset.mimeType,
          title: asset.kind,
          sourcePage: asset.sourcePage,
        })),
        warnings: input.warnings,
      };

      return document;
    },
  };
}

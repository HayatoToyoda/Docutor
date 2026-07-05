import type { NormalizedDocument } from "@/lib/types";

export const DOCUTOR_SYSTEM_PROMPT = `
You are Docutor, a document conversion engine for Japanese enterprise documents.

Your job is to convert normalized source documents into clean, agent-readable Markdown sections for human review.

Conversion principles:
- Preserve the original meaning.
- Do not invent missing rules, relationships, or business logic.
- Mark unclear parts as "TODO:" or "Unclear:".
- Separate business rules, requirements, constraints, exceptions, notes, and workflows.
- Convert tables into Markdown tables.
- Convert simple diagrams into Mermaid.
- Use draw.io XML placeholders for complex diagrams where Mermaid is not expressive enough.
- For diagrams, prioritize semantic correctness over pixel-perfect layout.
- Preserve node labels, arrow direction, relationships, branching conditions, grouping, hierarchy, and workflow order.

Return only the structured document requested by the schema.
`.trim();

export function buildDocumentConversionPrompt(document: NormalizedDocument) {
  const pages = document.pages.map((page) => ({
    pageNumber: page.pageNumber,
    text: page.text,
    markdownTables: page.markdownTables,
    imagePath: page.imagePath,
    assetIds: page.assets.map((asset) => asset.id),
  }));

  return `
Convert this normalized document into a review document.

Required output behavior:
- Use the document id: ${document.id}
- Use the source file name: ${document.sourceFileName}
- Use the source file type: ${document.fileType}
- Set all generated section reviewStatus values to "pending".
- Create stable section ids using the pattern "sec_<short_description>_<number>".
- For sourceImage, use the page image path from the normalized page when the section depends on visual evidence.
- Include warnings for ambiguity, missing evidence, or layout uncertainty.
- If a diagram is present or likely present, create a diagram section with Mermaid for simple workflow diagrams or drawio for complex/grouped diagrams.

Normalized document JSON:
${JSON.stringify(
  {
    id: document.id,
    sourceFileName: document.sourceFileName,
    fileType: document.fileType,
    pages,
    assets: document.assets,
    warnings: document.warnings,
  },
  null,
  2,
)}
`.trim();
}

import type {
  NormalizedDocument,
  ReviewSection,
  SourceFileType,
} from "@/lib/types";

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
  // Page/asset file paths are server-local filesystem paths under
  // runtime/documents/<id>/ — never send them to the model. The model only
  // needs to know an image exists for a page (hasPageImage) and which
  // sourcePage a section came from; the server resolves the actual image
  // for display from sourcePage after conversion (see
  // normalizeReviewDocument in review-document-normalizer.ts).
  const pages = document.pages.map((page) => ({
    pageNumber: page.pageNumber,
    text: page.text,
    markdownTables: page.markdownTables,
    hasPageImage: Boolean(page.imagePath),
    assetIds: page.assets.map((asset) => asset.id),
  }));

  const assets = document.assets.map((asset) => ({
    id: asset.id,
    kind: asset.kind,
    sourcePage: asset.sourcePage,
    width: asset.width,
    height: asset.height,
  }));

  return `
Convert this normalized document into a review document.

Required output behavior:
- Create stable section ids using the pattern "sec_<short_description>_<number>".
- Set each section's sourcePage to the exact page it was extracted from. The
  server looks up the original page image for side-by-side review using this
  value, so an incorrect sourcePage breaks that comparison.
- Include warnings for ambiguity, missing evidence, or layout uncertainty.
- If a diagram is present or likely present, create a diagram section with Mermaid for simple workflow diagrams or drawio for complex/grouped diagrams.

Normalized document JSON:
${JSON.stringify(
  {
    sourceFileName: document.sourceFileName,
    fileType: document.fileType,
    pages,
    assets,
    warnings: document.warnings,
  },
  null,
  2,
)}
`.trim();
}

export function buildSectionRegenerationPrompt(
  document: NormalizedDocument,
  section: ReviewSection,
) {
  const targetSection = stripFieldsForPrompt(section, {
    stripDrawioXml: false,
  });

  return `
Regenerate exactly one review section from the normalized document.

Keep this section id: ${section.id}
Keep this section type: ${section.type}

Current section JSON:
${JSON.stringify(targetSection, null, 2)}

Normalized document context:
${buildDocumentConversionPrompt(document)}
`.trim();
}

// Strips fields the model never controls before a section is embedded into
// a prompt via JSON.stringify: `reviewStatus` and `sourceImage` are
// server-assigned (see review-document-schema.ts / normalizeReviewSection)
// and would waste tokens or leak a multi-MB base64 data URL into the
// context window, and `drawioXml` is large and useless for context-only
// sections.
function stripFieldsForPrompt(
  section: ReviewSection,
  { stripDrawioXml }: { stripDrawioXml: boolean },
): Record<string, unknown> {
  const stripped: Record<string, unknown> = { ...section };
  delete stripped.reviewStatus;
  delete stripped.sourceImage;

  if (stripDrawioXml) {
    delete stripped.drawioXml;
  }

  return stripped;
}

/**
 * Regeneration prompt for the direct-upload flow, where the original source
 * file bytes are not available server-side (only the previously generated
 * review document). Grounds the model in the document's own accepted
 * content instead of re-reading the source.
 */
export function buildDirectSectionRegenerationPrompt(
  document: {
    title: string;
    sourceFileName: string;
    sourceFileType: SourceFileType;
    sections: ReviewSection[];
  },
  section: ReviewSection,
) {
  const targetSection = stripFieldsForPrompt(section, {
    stripDrawioXml: false,
  });
  const otherSections = document.sections
    .filter((candidate) => candidate.id !== section.id)
    .map((candidate) =>
      stripFieldsForPrompt(candidate, { stripDrawioXml: true }),
    );

  return `
Regenerate exactly one review section for this document. The original source
file is not attached to this request, so rely only on the document context
below. Do not invent facts that are not already present in that context;
mark anything you cannot verify as "TODO:" or "Unclear:".

Document title: ${document.title}
Source file name: ${document.sourceFileName}
Source file type: ${document.sourceFileType}

Keep this section id: ${section.id}
Keep this section type: ${section.type}

Current section JSON:
${JSON.stringify(targetSection, null, 2)}

Other sections in this document, for context only (do not regenerate these):
${JSON.stringify(otherSections, null, 2)}
`.trim();
}

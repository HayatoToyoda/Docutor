import { renderSectionBodyMarkdown } from "@/lib/document-model";
import type { ReviewDocument, ReviewSection } from "@/lib/types";

function renderSection(section: ReviewSection) {
  const blocks = [`## ${section.title}`, `Source page: ${section.sourcePage}`];

  if (section.notes?.length) {
    blocks.push(section.notes.map((note) => `> ${note}`).join("\n"));
  }

  // generatedCode is the editable source of truth for diagrams (it drives
  // the live preview too), so export must render from it rather than the
  // possibly-stale generatedMarkdown snapshot captured at conversion time —
  // renderSectionBodyMarkdown (shared with the agent JSONL export) applies
  // that rule.
  blocks.push(renderSectionBodyMarkdown(section));

  return blocks.filter(Boolean).join("\n\n");
}

function escapeYamlDoubleQuoted(value: string) {
  return value.replace(/"/g, '\\"');
}

/**
 * YAML front-matter (F-6) so `document.md` is directly parseable by
 * front-matter-aware Markdown/RAG tooling without inspecting the body. Kept
 * to the four fields callers actually need — title/source for
 * provenance, generated for freshness, warnings as a cheap "does this need
 * a human look" signal — rather than duplicating everything already in
 * `manifest.json`/`agent/document.json`.
 */
function renderFrontMatter(document: ReviewDocument) {
  return [
    "---",
    `title: "${escapeYamlDoubleQuoted(document.title)}"`,
    `source: "${escapeYamlDoubleQuoted(document.sourceFileName)}"`,
    `generated: "${document.updatedAt}"`,
    `warnings: ${document.warnings.length}`,
    "---",
  ].join("\n");
}

export function renderReviewDocumentMarkdown(document: ReviewDocument) {
  const acceptedSections = document.sections.filter(
    (section) => section.reviewStatus === "accepted",
  );

  const blocks = [
    `# ${document.title}`,
    `Source: ${document.sourceFileName}`,
    `Generated: ${document.updatedAt}`,
  ];

  if (document.warnings.length > 0) {
    blocks.push(
      [
        "## Warnings",
        ...document.warnings.map((warning) => `- ${warning}`),
      ].join("\n"),
    );
  }

  if (acceptedSections.length === 0) {
    blocks.push("TODO: No accepted sections were available at export time.");
  } else {
    blocks.push(...acceptedSections.map(renderSection));
  }

  return `${renderFrontMatter(document)}\n\n${blocks.join("\n\n")}\n`;
}

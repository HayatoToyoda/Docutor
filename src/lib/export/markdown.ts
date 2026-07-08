import { stripMermaidFence } from "@/lib/diagrams/diagram-ir";
import type { ReviewDocument, ReviewSection } from "@/lib/types";

function renderSection(section: ReviewSection) {
  const blocks = [`## ${section.title}`, `Source page: ${section.sourcePage}`];

  if (section.notes?.length) {
    blocks.push(section.notes.map((note) => `> ${note}`).join("\n"));
  }

  if (section.type === "diagram") {
    // generatedCode is the editable source of truth for diagrams (it drives
    // the live preview too), so export must render from it rather than the
    // possibly-stale generatedMarkdown snapshot captured at conversion time.
    if (section.format === "mermaid") {
      blocks.push(
        `\`\`\`mermaid\n${stripMermaidFence(section.generatedCode)}\n\`\`\``,
      );
    } else {
      blocks.push("TODO: draw.io diagram exported as related asset.");
    }
  } else {
    blocks.push(section.generatedMarkdown.trim());
  }

  return blocks.filter(Boolean).join("\n\n");
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

  return `${blocks.join("\n\n")}\n`;
}

import type { ReviewDocument, ReviewSection } from "@/lib/types";

function renderSection(section: ReviewSection) {
  const blocks = [`## ${section.title}`, `Source page: ${section.sourcePage}`];

  if (section.notes?.length) {
    blocks.push(section.notes.map((note) => `> ${note}`).join("\n"));
  }

  if (section.type === "diagram") {
    if (section.generatedMarkdown.trim()) {
      blocks.push(section.generatedMarkdown.trim());
    } else if (section.format === "mermaid") {
      blocks.push(`\`\`\`mermaid\n${section.generatedCode}\n\`\`\``);
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

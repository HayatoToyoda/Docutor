import type { ReviewDocument, ReviewSection } from "./types";

/**
 * A single "TODO:" or "Unclear:" marker found in a section's generated
 * Markdown or its review notes. Docutor's Conversion Rules require these
 * markers to stay visible instead of being silently resolved by the model,
 * so this module exists to make them discoverable in the UI rather than
 * only counted (see F-8 in docs/plans/02-feature-roadmap-plan.md).
 */
export type AttentionMarker = {
  sectionId: string;
  sectionTitle: string;
  marker: "TODO" | "Unclear";
  line: string;
};

const TODO_PATTERN = /TODO:/;
const UNCLEAR_PATTERN = /Unclear:/;

// A line can contain both a TODO and an Unclear marker (e.g. a single
// annotation mixing both); each present marker type counts once for that
// line, matching the plan's "a line containing both counts once per marker
// type present" rule.
function extractMarkersFromText(
  text: string,
  sectionId: string,
  sectionTitle: string,
): AttentionMarker[] {
  const markers: AttentionMarker[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (TODO_PATTERN.test(line)) {
      markers.push({ sectionId, sectionTitle, marker: "TODO", line });
    }
    if (UNCLEAR_PATTERN.test(line)) {
      markers.push({ sectionId, sectionTitle, marker: "Unclear", line });
    }
  }

  return markers;
}

/** Attention markers for a single section's Markdown and notes. */
export function extractSectionAttentionMarkers(
  section: ReviewSection,
): AttentionMarker[] {
  const fromMarkdown = extractMarkersFromText(
    section.generatedMarkdown,
    section.id,
    section.title,
  );
  const fromNotes = (section.notes ?? []).flatMap((note) =>
    extractMarkersFromText(note, section.id, section.title),
  );

  return [...fromMarkdown, ...fromNotes];
}

/** Attention markers across every section of a document, in section order. */
export function extractAttentionMarkers(
  document: ReviewDocument,
): AttentionMarker[] {
  return document.sections.flatMap((section) =>
    extractSectionAttentionMarkers(section),
  );
}

/** Total marker count across a document; used for at-a-glance counts. */
export function countAttentionMarkers(document: ReviewDocument): number {
  return extractAttentionMarkers(document).length;
}

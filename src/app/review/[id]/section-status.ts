import type { DictionaryKey } from "@/lib/i18n/dictionaries";
import type { DiagramSection, ReviewSection } from "@/lib/types";

export function isDiagramSection(
  section: ReviewSection | null,
): section is DiagramSection {
  return section?.type === "diagram";
}

export function statusTone(status: ReviewSection["reviewStatus"]) {
  if (status === "accepted") {
    return "bg-success/10 text-success";
  }
  if (status === "rejected") {
    return "bg-destructive/10 text-destructive";
  }
  if (status === "regenerating") {
    return "bg-warning/10 text-warning";
  }
  return "bg-muted text-muted-foreground";
}

export function statusDotClass(status: ReviewSection["reviewStatus"]) {
  if (status === "accepted") return "bg-success";
  if (status === "rejected") return "bg-destructive";
  if (status === "regenerating") return "bg-warning";
  return "bg-[#9aa0ab]";
}

// Returns a dictionary key rather than translated text directly: this file
// is a plain module (not a hook or component), so it can't call useT()
// itself. Callers resolve the label with their own t() — e.g.
// `t(statusLabelKey(section.reviewStatus))`.
export function statusLabelKey(
  status: ReviewSection["reviewStatus"],
): DictionaryKey {
  if (status === "accepted") return "reviewStatus.accepted";
  if (status === "rejected") return "reviewStatus.rejected";
  if (status === "regenerating") return "reviewStatus.regenerating";
  return "reviewStatus.pending";
}

export function typeLabelKey(section: ReviewSection): DictionaryKey {
  switch (section.type) {
    case "heading":
      return "sectionType.heading";
    case "paragraph":
      return "sectionType.text";
    case "table":
      return "sectionType.table";
    case "diagram":
      return "sectionType.diagram";
    case "image":
      return "sectionType.image";
    case "requirement":
      return "sectionType.requirement";
    case "note":
      return "sectionType.note";
    default:
      return "sectionType.text";
  }
}

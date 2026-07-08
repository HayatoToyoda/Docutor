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

export function statusLabel(status: ReviewSection["reviewStatus"]) {
  if (status === "accepted") return "Accepted";
  if (status === "rejected") return "Rejected";
  if (status === "regenerating") return "Regenerating";
  return "Pending review";
}

export function typeLabel(section: ReviewSection) {
  return section.type === "paragraph" ? "TEXT" : section.type.toUpperCase();
}

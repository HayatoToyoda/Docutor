"use client";

import { Progress } from "@/components/ui/progress";
import type { ReviewSection } from "@/lib/types";
import { statusDotClass, statusLabel, typeLabel } from "./section-status";

export function SectionList({
  documentTitle,
  sections,
  selectedSectionId,
  acceptedCount,
  progress,
  onSelectSection,
  children,
}: {
  documentTitle: string;
  sections: ReviewSection[];
  selectedSectionId: string | null;
  acceptedCount: number;
  progress: number;
  onSelectSection: (sectionId: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <aside className="flex min-h-0 flex-col border-r border-border bg-card">
      <div className="border-b border-[#f0f1f4] p-4">
        <p className="truncate text-sm font-semibold">{documentTitle}</p>
        <p className="mt-1 text-xs text-[#8b8f9a]">
          {sections.length} sections · {acceptedCount} accepted
        </p>
        <Progress className="mt-3" value={progress} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {sections.map((section) => (
          <button
            className={`mb-0.5 w-full rounded-lg border px-3 py-2.5 text-left transition ${
              selectedSectionId === section.id
                ? "border-[#c7cdf1] bg-accent"
                : "border-transparent hover:bg-[#f3f4f8]"
            }`}
            key={section.id}
            onClick={() => onSelectSection(section.id)}
            type="button"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold tracking-[0.06em] text-[#8b8f9a]">
                {typeLabel(section)}
              </span>
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(
                  section.reviewStatus,
                )}`}
              />
            </span>
            <span className="mt-1.5 block text-[13px] font-medium leading-5">
              {section.title}
            </span>
            <span className="mt-0.5 block text-[11px] text-[#9aa0ab]">
              Page {section.sourcePage} · {statusLabel(section.reviewStatus)}
            </span>
          </button>
        ))}
      </div>

      {children}
    </aside>
  );
}

"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { AttentionMarker } from "@/lib/attention";
import { useT } from "@/lib/i18n/locale-context";

/**
 * Compact quality panel for the review sidebar (F-8): surfaces every
 * TODO:/Unclear: marker left in the document so a reviewer can jump straight
 * to the section that needs a decision, instead of hunting for markers by
 * reading every section.
 */
export function QualityPanel({
  markers,
  onSelectSection,
}: {
  markers: AttentionMarker[];
  onSelectSection: (sectionId: string) => void;
}) {
  const { t } = useT();
  const [expanded, setExpanded] = useState(false);

  if (markers.length === 0) {
    return null;
  }

  return (
    <div className="shrink-0 border-t border-[#f0f1f4] p-3">
      <button
        aria-expanded={expanded}
        className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left hover:bg-[#f3f4f8]"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span className="text-xs font-semibold tracking-[0.04em] text-[#6b6f7b]">
          {t("review.needsAttention")}
        </span>
        <span className="flex items-center gap-1.5">
          <Badge className="bg-warning/10 text-warning">
            {markers.length}
          </Badge>
          <span className="text-[10px] text-[#9aa0ab]">
            {expanded ? "▲" : "▼"}
          </span>
        </span>
      </button>

      {expanded ? (
        <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto">
          {markers.map((marker, index) => (
            <li key={`${marker.sectionId}-${marker.marker}-${index}`}>
              <button
                className="block w-full truncate rounded px-2 py-1.5 text-left text-[11px] leading-4 text-[#6b6f7b] hover:bg-[#f3f4f8]"
                onClick={() => onSelectSection(marker.sectionId)}
                title={marker.line}
                type="button"
              >
                <span className="font-semibold text-warning">
                  {marker.marker}
                </span>{" "}
                <span className="text-[#9aa0ab]">
                  · {marker.sectionTitle} ·
                </span>{" "}
                {marker.line}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

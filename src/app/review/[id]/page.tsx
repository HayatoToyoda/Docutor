"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AppHeader } from "@/app/components/app-header";
import { Button } from "@/components/ui/button";
import { extractAttentionMarkers } from "@/lib/attention";
import { QualityPanel } from "./quality-panel";
import { SectionDetail } from "./section-detail";
import { SectionList } from "./section-list";
import { useReviewDocument } from "./use-review-document";

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");

  const {
    job,
    reviewDocument,
    sections,
    selectedSection,
    setSelectedSectionId,
    sourceImageUrl,
    message,
    isSaving,
    updateLocalSection,
    saveSection,
    regenerateSection,
    downloadExport,
    acceptedCount,
    reviewedCount,
    progress,
  } = useReviewDocument(params.id);

  const attentionMarkers = useMemo(
    () => (reviewDocument ? extractAttentionMarkers(reviewDocument) : []),
    [reviewDocument],
  );

  function selectSection(sectionId: string) {
    setSelectedSectionId(sectionId);
    setViewMode("preview");
  }

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader
        activeStep="review"
        status={message ?? `${acceptedCount} sections accepted`}
      />

      <div className="grid min-h-0 flex-1 lg:h-[calc(100vh-56px)] lg:grid-cols-[292px_minmax(0,1fr)]">
        <SectionList
          acceptedCount={acceptedCount}
          documentTitle={
            reviewDocument?.sourceFileName ?? job?.sourceFileName ?? "Document"
          }
          onSelectSection={selectSection}
          progress={progress}
          sections={sections}
          selectedSectionId={selectedSection?.id ?? null}
        >
          <QualityPanel
            markers={attentionMarkers}
            onSelectSection={selectSection}
          />
        </SectionList>

        <section className="flex min-h-0 min-w-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6">
            <SectionDetail
              isSaving={isSaving}
              onRegenerate={() =>
                selectedSection && regenerateSection(selectedSection.id)
              }
              onSave={(patch) =>
                selectedSection && saveSection(selectedSection.id, patch)
              }
              onUpdateLocal={(patch) =>
                selectedSection &&
                updateLocalSection(selectedSection.id, patch)
              }
              onViewModeChange={setViewMode}
              selectedSection={selectedSection}
              sourceImageUrl={sourceImageUrl}
              viewMode={viewMode}
              warnings={reviewDocument?.warnings ?? []}
            />
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 sm:px-7">
            <div className="flex items-center gap-3 text-xs text-[#6b6f7b]">
              <span>
                {reviewedCount} of {sections.length} sections reviewed
              </span>
              <Button
                disabled={acceptedCount === 0}
                onClick={() => downloadExport("markdown")}
                type="button"
                variant="link"
              >
                Download Markdown
              </Button>
              <Button
                disabled={acceptedCount === 0}
                onClick={() => downloadExport("zip")}
                type="button"
                variant="link"
              >
                Download ZIP
              </Button>
            </div>
            <Button
              disabled={sections.length === 0 || reviewedCount !== sections.length}
              onClick={() => router.push(`/complete/${params.id}`)}
              size="lg"
              type="button"
            >
              Complete review →
            </Button>
          </footer>
        </section>
      </div>
    </main>
  );
}

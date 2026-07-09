"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { extractSectionAttentionMarkers } from "@/lib/attention";
import type { SectionPatch } from "@/lib/document-model";
import { useT } from "@/lib/i18n/locale-context";
import type { ReviewSection } from "@/lib/types";
import { DrawioEditor } from "./drawio-editor";
import { MermaidPreview } from "./mermaid-preview";
import {
  isDiagramSection,
  statusLabelKey,
  statusTone,
  typeLabelKey,
} from "./section-status";

type SourceTab = "text" | "image";

// Zoom overlay for the page image: click anywhere on the backdrop or press
// Escape to close.
function ImageZoomModal({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-6"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] object-contain"
        src={src}
      />
    </div>
  );
}

// Tabbed ORIGINAL SOURCE pane shared by diagram and non-diagram sections
// (F-2): lets a reviewer compare either the extracted text or the source
// page image against the generated output, with the image zoomable. Keyed
// by section id from the caller so tab/zoom state resets whenever the
// selected section changes.
function OriginalSourcePane({
  section,
  sourceImageUrl,
}: {
  section: ReviewSection;
  sourceImageUrl: string | null;
}) {
  const { t } = useT();
  const hasImage = Boolean(sourceImageUrl);
  const hasText = Boolean(section.originalText);
  const preferImage = !hasText || isDiagramSection(section);
  const [tab, setTab] = useState<SourceTab>(
    hasImage && preferImage ? "image" : "text",
  );
  const [zoomed, setZoomed] = useState(false);
  const imageAlt = t("review.originalSourceAlt", {
    page: section.sourcePage,
  });

  return (
    <Card className="gap-0 rounded-[10px] py-0">
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <span className="text-xs font-semibold tracking-[0.04em] text-[#6b6f7b]">
          {t("review.originalSourceHeading", { page: section.sourcePage })}
        </span>
        <ToggleGroup
          className="rounded-md bg-secondary p-0.5"
          onValueChange={(values) => {
            const next = values[0];
            if (next) setTab(next as SourceTab);
          }}
          spacing={0}
          value={[tab]}
        >
          <ToggleGroupItem
            className="rounded-[5px] px-3 py-1 text-xs font-medium hover:bg-transparent data-pressed:bg-white data-pressed:text-foreground data-pressed:shadow-sm"
            value="text"
          >
            {t("common.text")}
          </ToggleGroupItem>
          <ToggleGroupItem
            className="rounded-[5px] px-3 py-1 text-xs font-medium hover:bg-transparent data-pressed:bg-white data-pressed:text-foreground data-pressed:shadow-sm disabled:pointer-events-none disabled:opacity-40"
            disabled={!hasImage}
            value="image"
          >
            {t("review.pageImage")}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <Separator />
      {tab === "image" && sourceImageUrl ? (
        <button
          className="flex min-h-[330px] w-full cursor-zoom-in items-center justify-center overflow-auto bg-[#fafafb] p-3"
          onClick={() => setZoomed(true)}
          type="button"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={imageAlt}
            className="max-h-[520px] w-auto max-w-full rounded border border-[#e5e6ea] object-contain"
            src={sourceImageUrl}
          />
        </button>
      ) : (
        <div className="min-h-[330px] whitespace-pre-wrap bg-[#fafafb] p-4 text-[13px] leading-7 text-[#4a4e58]">
          {section.originalText || t("review.originalTextMissing")}
        </div>
      )}

      {zoomed && sourceImageUrl ? (
        <ImageZoomModal
          alt={imageAlt}
          onClose={() => setZoomed(false)}
          src={sourceImageUrl}
        />
      ) : null}
    </Card>
  );
}

export function SectionDetail({
  warnings,
  selectedSection,
  sourceImageUrl,
  viewMode,
  onViewModeChange,
  isSaving,
  onRegenerate,
  onSave,
  onUpdateLocal,
}: {
  warnings: string[];
  selectedSection: ReviewSection | null;
  sourceImageUrl: string | null;
  viewMode: "preview" | "edit";
  onViewModeChange: (mode: "preview" | "edit") => void;
  isSaving: boolean;
  onRegenerate: (instruction?: string) => void;
  onSave: (patch: SectionPatch) => void;
  onUpdateLocal: (patch: SectionPatch) => void;
}) {
  const { t } = useT();
  // Accept-with-unresolved-markers confirmation (F-8): the first click on a
  // section that still has TODO:/Unclear: markers arms a warning-styled
  // confirmation instead of blocking with window.confirm; a second click
  // within the window accepts. Resets when the selected section changes or
  // after 3s of inactivity.
  const [acceptConfirmArmed, setAcceptConfirmArmed] = useState(false);
  // Instructed regeneration popover (F-3): a compact card anchored under the
  // Regenerate button holding an optional free-text instruction.
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [instructionDraft, setInstructionDraft] = useState("");
  const selectedSectionId = selectedSection?.id ?? null;
  const unresolvedMarkerCount = selectedSection
    ? extractSectionAttentionMarkers(selectedSection).length
    : 0;

  // Reset the armed confirmation and the regenerate popover when the
  // selected section changes. This adjusts state during render (React's
  // recommended pattern for resetting state on a prop change) rather than
  // in an effect, avoiding an extra render pass.
  const [trackedSectionId, setTrackedSectionId] = useState(selectedSectionId);
  if (trackedSectionId !== selectedSectionId) {
    setTrackedSectionId(selectedSectionId);
    if (acceptConfirmArmed) setAcceptConfirmArmed(false);
    if (regenerateOpen) setRegenerateOpen(false);
    if (instructionDraft) setInstructionDraft("");
  }

  function closeRegeneratePopover() {
    setRegenerateOpen(false);
    setInstructionDraft("");
  }

  function submitRegenerate() {
    const trimmed = instructionDraft.trim();
    onRegenerate(trimmed || undefined);
    closeRegeneratePopover();
  }

  useEffect(() => {
    if (!acceptConfirmArmed) return;
    const timer = setTimeout(() => setAcceptConfirmArmed(false), 3000);
    return () => clearTimeout(timer);
  }, [acceptConfirmArmed]);

  function handleAcceptClick() {
    if (unresolvedMarkerCount > 0 && !acceptConfirmArmed) {
      setAcceptConfirmArmed(true);
      return;
    }
    setAcceptConfirmArmed(false);
    onSave({ reviewStatus: "accepted" });
  }

  return (
    <div className="mx-auto max-w-[1120px]">
      {warnings.length ? (
        <Alert className="mb-4 border-warning/30 bg-warning/5">
          <AlertDescription className="text-warning">
            <ul className="list-disc space-y-1 pl-4">
              {warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {selectedSection ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-accent text-accent-foreground">
                  {t(typeLabelKey(selectedSection))}
                </Badge>
                <Badge className={statusTone(selectedSection.reviewStatus)}>
                  {t(statusLabelKey(selectedSection.reviewStatus))}
                </Badge>
              </div>
              <h1 className="mt-2 text-xl font-semibold">
                {selectedSection.title}
              </h1>
              <p className="mt-1 text-xs text-[#8b8f9a]">
                {t("review.sourcePage", { page: selectedSection.sourcePage })}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Button
                  aria-expanded={regenerateOpen}
                  disabled={isSaving}
                  onClick={() => setRegenerateOpen((current) => !current)}
                  type="button"
                  variant="outline"
                >
                  {isSaving ? t("review.regenerating") : t("review.regenerate")}
                </Button>

                {regenerateOpen ? (
                  <Card className="absolute left-0 top-full z-20 mt-2 w-80 gap-2 rounded-[10px] p-3 shadow-lg">
                    <Textarea
                      autoFocus
                      className="h-20 resize-none text-xs"
                      onChange={(event) =>
                        setInstructionDraft(event.target.value)
                      }
                      placeholder={t("review.instructionPlaceholder")}
                      value={instructionDraft}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={closeRegeneratePopover}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        {t("common.cancel")}
                      </Button>
                      <Button
                        disabled={isSaving}
                        onClick={submitRegenerate}
                        size="sm"
                        type="button"
                      >
                        {t("review.regenerateSubmit")}
                      </Button>
                    </div>
                  </Card>
                ) : null}
              </div>
              <Button
                disabled={isSaving}
                onClick={() => onSave({ reviewStatus: "rejected" })}
                type="button"
                variant="destructive"
              >
                {t("common.reject")}
              </Button>
              <Button
                className={
                  acceptConfirmArmed
                    ? "bg-warning text-warning-foreground hover:bg-warning/90"
                    : "bg-success text-success-foreground hover:bg-success/90"
                }
                disabled={isSaving}
                onClick={handleAcceptClick}
                type="button"
              >
                {acceptConfirmArmed
                  ? t("review.acceptConfirm", { count: unresolvedMarkerCount })
                  : t("review.accept")}
              </Button>
            </div>
          </div>

          {isDiagramSection(selectedSection) ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 xl:grid-cols-2">
                <OriginalSourcePane
                  key={selectedSection.id}
                  section={selectedSection}
                  sourceImageUrl={sourceImageUrl}
                />
                <Card className="gap-0 rounded-[10px] py-0">
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="text-xs font-semibold tracking-[0.04em] text-[#6b6f7b]">
                      {t("review.generatedPreview")}
                    </span>
                    <span className="text-[11px] text-[#9aa0ab]">
                      {selectedSection.format}
                    </span>
                  </div>
                  <Separator />
                  {selectedSection.format === "mermaid" ? (
                    <MermaidPreview code={selectedSection.generatedCode} />
                  ) : (
                    <div className="p-4 text-sm text-[#6b6f7b]">
                      {t("review.openDrawioHint")}
                    </div>
                  )}
                </Card>
              </div>

              <Card className="gap-0 rounded-[10px] py-0">
                <div className="px-3.5 py-2.5 text-xs font-semibold tracking-[0.04em] text-[#6b6f7b]">
                  {t("review.diagramSource")}
                </div>
                <Separator />
                {selectedSection.format === "mermaid" ? (
                  <Textarea
                    className="h-64 resize-y rounded-none border-0 bg-[#fcfcfd] p-4 font-mono text-xs leading-6 text-foreground focus-visible:ring-0"
                    onBlur={() =>
                      onSave({ generatedCode: selectedSection.generatedCode })
                    }
                    onChange={(event) =>
                      onUpdateLocal({ generatedCode: event.target.value })
                    }
                    value={selectedSection.generatedCode}
                  />
                ) : null}
                {selectedSection.drawioXml ? (
                  <div className="p-4">
                    <DrawioEditor
                      onChange={(nextXml) =>
                        onUpdateLocal({ drawioXml: nextXml })
                      }
                      onSave={(nextXml) => onSave({ drawioXml: nextXml })}
                      title={selectedSection.title}
                      xml={selectedSection.drawioXml}
                    />
                  </div>
                ) : null}
              </Card>
            </div>
          ) : (
            <div className="mt-4 grid items-start gap-4 xl:grid-cols-[5fr_7fr]">
              <OriginalSourcePane
                key={selectedSection.id}
                section={selectedSection}
                sourceImageUrl={sourceImageUrl}
              />

              <Card className="gap-0 rounded-[10px] py-0">
                <div className="flex items-center justify-between px-3.5 py-2">
                  <span className="text-xs font-semibold tracking-[0.04em] text-[#6b6f7b]">
                    {t("review.generatedMarkdown")}
                  </span>
                  <ToggleGroup
                    className="rounded-md bg-secondary p-0.5"
                    onValueChange={(values) => {
                      const next = values[0];
                      if (next) onViewModeChange(next as "preview" | "edit");
                    }}
                    spacing={0}
                    value={[viewMode]}
                  >
                    {(["preview", "edit"] as const).map((mode) => (
                      <ToggleGroupItem
                        className="rounded-[5px] px-3 py-1 text-xs font-medium hover:bg-transparent data-pressed:bg-white data-pressed:text-foreground data-pressed:shadow-sm"
                        key={mode}
                        value={mode}
                      >
                        {t(mode === "preview" ? "common.preview" : "common.edit")}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
                <Separator />
                {viewMode === "preview" ? (
                  <div className="docutor-markdown min-h-[320px] p-5">
                    <ReactMarkdown>
                      {selectedSection.generatedMarkdown}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <Textarea
                    className="h-[420px] resize-y rounded-none border-0 bg-[#fcfcfd] p-4 font-mono text-xs leading-6 text-foreground focus-visible:ring-0"
                    onBlur={() =>
                      onSave({
                        generatedMarkdown: selectedSection.generatedMarkdown,
                      })
                    }
                    onChange={(event) =>
                      onUpdateLocal({ generatedMarkdown: event.target.value })
                    }
                    value={selectedSection.generatedMarkdown}
                  />
                )}
              </Card>
            </div>
          )}
        </>
      ) : (
        <Card className="rounded-[10px] p-6 text-sm text-[#6b6f7b]">
          {t("review.noSections")}
        </Card>
      )}
    </div>
  );
}

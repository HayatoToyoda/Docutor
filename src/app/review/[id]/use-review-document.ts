"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildClientExport,
  downloadBlob,
  isClientDocumentId,
  isDemoDocumentId,
  patchClientSection,
  readClientDocument,
  saveClientDocument,
} from "@/lib/client-document-store";
import { appendInstructionNote, type SectionPatch } from "@/lib/document-model";
import { useT } from "@/lib/i18n/locale-context";
import type { ReviewSection, StoredDocumentJob } from "@/lib/types";

type DocumentPayload = {
  document: StoredDocumentJob;
};

// Resolves a viewable URL for the original page image behind a section, if
// one is available. Prefers an inline data URL captured directly on the
// section (used by the direct/demo client flows) and otherwise falls back
// to the server pipeline's per-page image endpoint.
function resolveSourceImageUrl(
  job: StoredDocumentJob | null,
  section: ReviewSection | null,
): string | null {
  if (!job || !section) return null;

  if (section.sourceImage?.startsWith("data:")) {
    return section.sourceImage;
  }

  // All sections of a direct image doc come from the single uploaded image
  // (page 1), captured once on the job instead of duplicated per section.
  if (job.directSourceImage) {
    return job.directSourceImage;
  }

  const page = job.normalizedDocument?.pages.find(
    (candidate) => candidate.pageNumber === section.sourcePage,
  );

  if (page?.imagePath) {
    return `/api/documents/${job.id}/pages/${section.sourcePage}/image`;
  }

  return null;
}

/**
 * Encapsulates all data concerns for the review page: loading a document
 * (client localStorage vs. server API, branching on the document id shape),
 * saving/regenerating sections, exporting, and the derived values the UI
 * needs. The review page component itself stays composition-only.
 */
export function useReviewDocument(documentId: string) {
  const { t } = useT();
  const [job, setJob] = useState<StoredDocumentJob | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  // Guards Accept/Reject/Regenerate against double-submit while a
  // save/regenerate request is in flight.
  const [isSaving, setIsSaving] = useState(false);

  const reviewDocument = job?.reviewDocument;
  const sections = useMemo(
    () => reviewDocument?.sections ?? [],
    [reviewDocument],
  );
  const selectedSection =
    sections.find((section) => section.id === selectedSectionId) ??
    sections[0] ??
    null;
  const sourceImageUrl = useMemo(
    () => resolveSourceImageUrl(job, selectedSection),
    [job, selectedSection],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadDocument() {
      if (isClientDocumentId(documentId)) {
        const document = readClientDocument(documentId);
        if (!document) {
          setMessage(t("common.documentLoadFailedClient"));
          return;
        }
        setJob(document);
        setSelectedSectionId(
          document.reviewDocument?.sections[0]?.id ?? null,
        );
        return;
      }

      try {
        const response = await fetch(`/api/documents/${documentId}`);
        const payload = (await response.json()) as DocumentPayload;

        if (!response.ok) {
          if (!cancelled) setMessage(t("common.documentLoadFailed"));
          return;
        }

        if (!cancelled) {
          setJob(payload.document);
          setSelectedSectionId(
            payload.document.reviewDocument?.sections[0]?.id ?? null,
          );
        }
      } catch {
        if (!cancelled) setMessage(t("common.documentLoadFailed"));
      }
    }

    loadDocument();
    return () => {
      cancelled = true;
    };
  }, [documentId, t]);

  function updateLocalSection(sectionId: string, patch: SectionPatch) {
    setJob((current) => {
      if (!current?.reviewDocument) {
        return current;
      }

      const updated = patchClientSection(current, sectionId, patch);
      if (isClientDocumentId(documentId)) {
        saveClientDocument(updated);
      }
      return updated;
    });
  }

  async function saveSection(sectionId: string, patch: SectionPatch) {
    updateLocalSection(sectionId, patch);
    setMessage(t("review.savingSection"));
    setIsSaving(true);

    try {
      if (isClientDocumentId(documentId)) {
        setMessage(t("review.sectionSavedClient"));
        return;
      }

      const response = await fetch(
        `/api/documents/${documentId}/sections/${sectionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      const payload = (await response.json()) as DocumentPayload;

      if (!response.ok) {
        setMessage(t("review.sectionUpdateFailed"));
        return;
      }

      setJob(payload.document);
      setMessage(t("review.sectionSaved"));
    } finally {
      setIsSaving(false);
    }
  }

  async function regenerateSection(sectionId: string, instruction?: string) {
    setMessage(t("review.regeneratingSection"));
    setIsSaving(true);
    updateLocalSection(sectionId, { reviewStatus: "regenerating" });

    try {
      // "demo-" documents never called a real provider and have no source
      // file behind them, so regeneration stays a client-side placeholder.
      if (isDemoDocumentId(documentId)) {
        const section = sections.find((item) => item.id === sectionId);
        if (!section) return;
        const placeholderPatch: SectionPatch =
          section.type === "diagram"
            ? {
                generatedCode: `${section.generatedCode}\n  %% Regenerated in demo mode`,
                generatedMarkdown: `\`\`\`mermaid\n${section.generatedCode}\n  %% Regenerated in demo mode\n\`\`\``,
                reviewStatus: "pending",
              }
            : {
                generatedMarkdown: `${section.generatedMarkdown}\n\nTODO: Regenerated in demo mode for review.`,
                reviewStatus: "pending",
              };

        // Audit trail (F-3): even the demo placeholder records the
        // instruction as a note, so demo mode still demonstrates the
        // human-feedback flow end to end.
        const withNote = appendInstructionNote(
          { ...section, ...placeholderPatch } as ReviewSection,
          instruction,
        );
        updateLocalSection(sectionId, {
          ...placeholderPatch,
          notes: withNote.notes,
        });

        setMessage(t("review.demoRegenerateNotice"));
        return;
      }

      // "direct-" documents were produced by a real LLM call and live only
      // in this browser, so regenerate them for real via the stateless
      // direct API.
      if (isClientDocumentId(documentId)) {
        if (!reviewDocument) return;

        try {
          // Don't upload megabytes of base64 to regenerate a text section:
          // the server strips these the same way before embedding sections
          // into the LLM prompt (see buildDirectSectionRegenerationPrompt).
          const requestSections = reviewDocument.sections.map((item) =>
            item.sourceImage?.startsWith("data:")
              ? ({ ...item, sourceImage: "" } as ReviewSection)
              : item,
          );

          const trimmedInstruction = instruction?.trim();
          const response = await fetch("/api/convert-direct/regenerate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: reviewDocument.title,
              sourceFileName: reviewDocument.sourceFileName,
              sourceFileType: reviewDocument.sourceFileType,
              sections: requestSections,
              sectionId,
              ...(trimmedInstruction ? { instruction: trimmedInstruction } : {}),
            }),
          });
          const payload = (await response.json()) as {
            section?: ReviewSection;
            error?: string;
          };

          if (!response.ok || !payload.section) {
            updateLocalSection(sectionId, { reviewStatus: "pending" });
            setMessage(payload.error ?? t("review.sectionRegenerationFailed"));
            return;
          }

          // The regenerated section's sourceImage/originalText may come
          // back empty (the request stripped the image, and the model has
          // no better source text), so keep the previously stored values
          // rather than letting an empty response erase them.
          const previousSection = sections.find(
            (item) => item.id === sectionId,
          );
          const regeneratedSection = {
            ...payload.section,
            sourceImage:
              payload.section.sourceImage || previousSection?.sourceImage,
            originalText:
              payload.section.originalText || previousSection?.originalText,
          } as ReviewSection;

          updateLocalSection(sectionId, regeneratedSection);
          setMessage(t("review.sectionRegenerated"));
        } catch {
          updateLocalSection(sectionId, { reviewStatus: "pending" });
          setMessage(t("review.sectionRegenerationFailed"));
        }
        return;
      }

      // Server-managed documents regenerate through the configured default
      // provider (DOCUTOR_LLM_PROVIDER) rather than a hardcoded mock
      // provider.
      try {
        const trimmedInstruction = instruction?.trim();
        const response = await fetch(
          `/api/documents/${documentId}/sections/${sectionId}/regenerate`,
          trimmedInstruction
            ? {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ instruction: trimmedInstruction }),
              }
            : { method: "POST" },
        );
        const payload = (await response.json()) as {
          document?: StoredDocumentJob;
          error?: string;
        };

        if (!response.ok) {
          // A 500 here still carries the reverted document (status back to
          // "pending", error appended to notes), so apply it instead of
          // leaving the UI stuck showing "regenerating".
          if (payload.document) {
            setJob(payload.document);
          }
          setMessage(payload.error ?? t("review.sectionRegenerationFailed"));
          return;
        }

        if (payload.document) {
          setJob(payload.document);
        }
        setMessage(t("review.sectionRegenerated"));
      } catch {
        updateLocalSection(sectionId, { reviewStatus: "pending" });
        setMessage(t("review.sectionRegenerationFailed"));
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function downloadExport(kind: "markdown" | "zip") {
    const kindLabel = kind.toUpperCase();
    if (job && isClientDocumentId(documentId)) {
      try {
        const result = await buildClientExport(job, kind);
        downloadBlob(result.blob, result.fileName);
        setMessage(t("common.exportDownloaded", { kind: kindLabel }));
      } catch {
        setMessage(t("common.exportFailed", { kind: kindLabel }));
      }
      return;
    }

    // Wrapped like every other fetch in this hook (P1-4): a network failure
    // must show the export-failed message, not die as an unhandled
    // rejection with no feedback.
    try {
      const response = await fetch(
        `/api/documents/${documentId}/export/${kind}`,
        { method: "POST" },
      );

      if (!response.ok) {
        setMessage(t("common.exportFailed", { kind: kindLabel }));
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        kind === "markdown" ? `${documentId}.md` : `${documentId}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(t("common.exportDownloaded", { kind: kindLabel }));
    } catch {
      setMessage(t("common.exportFailed", { kind: kindLabel }));
    }
  }

  const acceptedCount = sections.filter(
    (section) => section.reviewStatus === "accepted",
  ).length;
  const reviewedCount = sections.filter(
    (section) =>
      section.reviewStatus === "accepted" ||
      section.reviewStatus === "rejected",
  ).length;
  const progress =
    sections.length === 0
      ? 0
      : Math.round((reviewedCount / sections.length) * 100);

  return {
    job,
    reviewDocument,
    sections,
    selectedSection,
    selectedSectionId,
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
  };
}

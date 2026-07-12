// Pure, framework-free helpers shared by the server API routes and the
// client-only (localStorage) document store. Keeping this logic here (and
// out of both `src/app/api/**/route.ts` and `client-document-store.ts`)
// means the two persistence layers can't drift apart on how a section patch
// is applied or how an export manifest/ZIP is assembled.
import { stripMermaidFence } from "@/lib/diagrams/diagram-ir";
import type {
  ReviewAsset,
  ReviewDocument,
  ReviewSection,
  SourceFileType,
  StoredDocumentJob,
} from "@/lib/types";

export type SectionPatch = {
  generatedMarkdown?: string;
  generatedCode?: string;
  drawioXml?: string;
  reviewStatus?: ReviewSection["reviewStatus"];
  notes?: string[];
};

/**
 * Appends a `[instruction] <text>` audit-trail entry to a section's notes,
 * used after an instructed regeneration (F-3) to record what the reviewer
 * asked for. Always appends onto whatever notes are already present rather
 * than replacing them — callers that need to preserve a prior section's
 * notes across a regeneration (which `normalizeReviewSection` otherwise
 * overwrites with the model's fresh output) should fold those notes into
 * `section.notes` before calling this. A missing/blank instruction is a
 * no-op that returns the section unchanged.
 */
export function appendInstructionNote(
  section: ReviewSection,
  instruction: string | undefined,
): ReviewSection {
  const trimmed = instruction?.trim();
  if (!trimmed) {
    return section;
  }

  return {
    ...section,
    notes: [...(section.notes ?? []), `[instruction] ${trimmed}`],
  } as ReviewSection;
}

/**
 * Applies a partial update to one section of a review document, returning a
 * new `ReviewDocument` (the input is never mutated) with `updatedAt`
 * refreshed.
 *
 * For diagram sections rendered as Mermaid, a patch that includes
 * `generatedCode` also resyncs `generatedMarkdown` to a fresh Mermaid fence
 * built from that code. This codifies the "generatedCode is the source of
 * truth for diagrams" rule that `src/lib/export/markdown.ts` already
 * enforces at export time (it renders diagram sections from `generatedCode`,
 * not the possibly-stale `generatedMarkdown` snapshot) — applying the same
 * rule here keeps the stored section internally consistent even before
 * export runs.
 */
export function applySectionPatch(
  reviewDocument: ReviewDocument,
  sectionId: string,
  patch: SectionPatch,
): ReviewDocument {
  const now = new Date().toISOString();

  const sections = reviewDocument.sections.map((section) => {
    if (section.id !== sectionId) {
      return section;
    }

    const next = { ...section, ...patch } as ReviewSection;

    if (
      next.type === "diagram" &&
      next.format === "mermaid" &&
      patch.generatedCode !== undefined
    ) {
      return {
        ...next,
        generatedMarkdown: `\`\`\`mermaid\n${stripMermaidFence(next.generatedCode)}\n\`\`\``,
      };
    }

    return next;
  });

  return {
    ...reviewDocument,
    updatedAt: now,
    sections,
  };
}

/**
 * Renders the body Markdown for a single section — the diagram-vs-text
 * rendering rule (diagrams render from `generatedCode`, not the possibly
 * stale `generatedMarkdown` snapshot; see `applySectionPatch` above for why)
 * lives here once so both the human-readable Markdown export
 * (`src/lib/export/markdown.ts`) and the agent JSONL export
 * (`buildAgentSectionsJsonl` below) can't drift apart on it. Does not
 * include the section's title/page header — callers that need that (the
 * Markdown export) add it around this body.
 */
export function renderSectionBodyMarkdown(section: ReviewSection): string {
  if (section.type === "diagram") {
    if (section.format === "mermaid") {
      return `\`\`\`mermaid\n${stripMermaidFence(section.generatedCode)}\n\`\`\``;
    }
    if (section.generatedMarkdown) {
      return section.generatedMarkdown.trim();
    }
    return "TODO: draw.io diagram exported as related asset.";
  }

  return section.generatedMarkdown.trim();
}

/**
 * Section review-status tallies shared by the F-1 history dashboard's two
 * data sources: the server's `listDocumentJobSummaries` (reading job.json
 * off disk) and the client store's `toDocumentSummary` (reading
 * localStorage). Keeping the tally rule in one place means "pending" and
 * "regenerating" sections are counted the same way — as still-open review
 * work — on both dashboards. Sections without a review document (job not
 * yet converted) simply produce all-zero counts.
 */
export function summarizeSectionCounts(sections: ReviewSection[]) {
  return {
    sectionCount: sections.length,
    acceptedCount: sections.filter(
      (section) => section.reviewStatus === "accepted",
    ).length,
    pendingCount: sections.filter(
      (section) =>
        section.reviewStatus === "pending" ||
        section.reviewStatus === "regenerating",
    ).length,
    rejectedCount: sections.filter(
      (section) => section.reviewStatus === "rejected",
    ).length,
  };
}

export type ExportManifest = {
  id: string;
  sourceFileName: string;
  sourceFileType: SourceFileType;
  exportedAt: string;
  acceptedSectionIds: string[];
  assets?: ReviewAsset[];
};

/**
 * Builds the `manifest.json` content included in both export paths: the
 * server ZIP builder (`src/lib/export/zip.ts`) and the client-only export
 * builder (`buildClientExport` in `src/lib/client-document-store.ts`).
 *
 * Shape choice (picked once, used by both): `status` (the document job's
 * processing status) is left out — it describes pipeline state, not the
 * exported artifact, and is meaningless once review has already completed.
 * `assets` is included only when the review document actually has assets,
 * so the client-only path (which never has server-stored assets) omits the
 * key entirely instead of emitting an empty array.
 */
export function buildExportManifest(job: StoredDocumentJob): ExportManifest {
  if (!job.reviewDocument) {
    throw new Error("Review document not found.");
  }

  const manifest: ExportManifest = {
    id: job.id,
    sourceFileName: job.sourceFileName,
    sourceFileType: job.sourceFileType,
    exportedAt: new Date().toISOString(),
    acceptedSectionIds: job.reviewDocument.sections
      .filter((section) => section.reviewStatus === "accepted")
      .map((section) => section.id),
  };

  if (job.reviewDocument.assets.length > 0) {
    manifest.assets = job.reviewDocument.assets;
  }

  return manifest;
}

export type DiagramExportFile = {
  path: string;
  content: string;
};

/**
 * Collects the `diagrams/<sectionId>.mmd` (fence-stripped Mermaid source)
 * and `diagrams/<sectionId>.drawio` entries for every diagram section in a
 * review document. Used by both the server ZIP builder and the client-only
 * export builder so their `diagrams/` contents stay identical in shape.
 */
export function collectDiagramExports(
  reviewDocument: ReviewDocument,
): DiagramExportFile[] {
  const files: DiagramExportFile[] = [];

  for (const section of reviewDocument.sections) {
    if (section.type !== "diagram") {
      continue;
    }

    if (section.format === "mermaid" && section.generatedCode) {
      files.push({
        path: `diagrams/${section.id}.mmd`,
        content: stripMermaidFence(section.generatedCode),
      });
    }

    if (section.drawioXml) {
      files.push({
        path: `diagrams/${section.id}.drawio`,
        content: section.drawioXml,
      });
    }
  }

  return files;
}

/**
 * Builds `agent/sections.jsonl` (F-6): one JSON line per *accepted* section,
 * shaped as an independent RAG chunk that carries its own traceability
 * fields (`sourceFile`/`sourcePage`) rather than requiring a join against
 * `agent/document.json`. Pending/rejected/regenerating sections are excluded
 * — the export represents reviewer-approved knowledge, matching the rule
 * `renderReviewDocumentMarkdown` already applies to `document.md`.
 *
 * Each record's keys are written in one fixed order (id, type, title,
 * sourceFile, sourcePage, markdown, reviewStatus, then the
 * present-only optional keys) so the JSONL output is deterministic across
 * runs, which is what the unit tests pin down.
 */
export function buildAgentSectionsJsonl(reviewDocument: ReviewDocument): string {
  const lines = reviewDocument.sections
    .filter((section) => section.reviewStatus === "accepted")
    .map((section) => {
      const record = {
        id: section.id,
        type: section.type,
        title: section.title,
        sourceFile: reviewDocument.sourceFileName,
        sourcePage: section.sourcePage,
        markdown: renderSectionBodyMarkdown(section),
        reviewStatus: section.reviewStatus,
        ...(section.notes?.length ? { notes: section.notes } : {}),
        ...(section.type === "diagram" && section.format === "mermaid"
          ? { mermaid: stripMermaidFence(section.generatedCode) }
          : {}),
        ...(section.type === "diagram" && section.drawioXml
          ? { drawioXml: section.drawioXml }
          : {}),
      };

      return JSON.stringify(record);
    });

  return lines.length > 0 ? `${lines.join("\n")}\n` : "";
}

export type AgentDocumentMetadata = {
  id: string;
  title: string;
  sourceFileName: string;
  sourceFileType: SourceFileType;
  convertedAt: string;
  exportedAt: string;
  warnings: string[];
  sectionOrder: string[];
  acceptedSectionIds: string[];
};

/**
 * Builds `agent/document.json` (F-6): document-level metadata to accompany
 * `agent/sections.jsonl` — the section order (for reconstructing sequence)
 * and which of those ids were accepted (duplicated from the per-line
 * `reviewStatus` for convenience, since a consumer that only wants "what
 * shipped" shouldn't have to scan every JSONL line).
 */
export function buildAgentDocumentJson(
  job: StoredDocumentJob,
): AgentDocumentMetadata {
  if (!job.reviewDocument) {
    throw new Error("Review document not found.");
  }

  const { reviewDocument } = job;

  return {
    id: job.id,
    title: reviewDocument.title,
    sourceFileName: job.sourceFileName,
    sourceFileType: job.sourceFileType,
    convertedAt: reviewDocument.createdAt,
    exportedAt: new Date().toISOString(),
    warnings: reviewDocument.warnings,
    sectionOrder: reviewDocument.sections.map((section) => section.id),
    acceptedSectionIds: reviewDocument.sections
      .filter((section) => section.reviewStatus === "accepted")
      .map((section) => section.id),
  };
}

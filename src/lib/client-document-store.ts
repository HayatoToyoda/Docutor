import JSZip from "jszip";
import { diagramIRToMermaid } from "@/lib/diagrams/diagram-ir";
import {
  applySectionPatch,
  buildExportManifest,
  collectDiagramExports,
  type SectionPatch,
} from "@/lib/document-model";
import { renderReviewDocumentMarkdown } from "@/lib/export/markdown";
import { detectSourceFileType } from "@/lib/file-types";
import type { DiagramIR, StoredDocumentJob } from "@/lib/types";

const STORAGE_PREFIX = "docutor:document:";

// Re-exported for compatibility with existing importers of the old local
// name; the type itself now lives in document-model.ts (shared with the
// server-side PATCH route).
export type { SectionPatch as ClientSectionPatch } from "@/lib/document-model";

export function isClientDocumentId(documentId: string) {
  return documentId.startsWith("direct-") || documentId.startsWith("demo-");
}

// "demo-" documents never called a real provider (see createDemoDocument
// below) and have no upload behind them to regenerate against, so
// regeneration stays a client-side placeholder. "direct-" documents were
// produced by a real LLM call and can be regenerated for real via
// /api/convert-direct/regenerate.
export function isDemoDocumentId(documentId: string) {
  return documentId.startsWith("demo-");
}

export function saveClientDocument(job: StoredDocumentJob) {
  localStorage.setItem(`${STORAGE_PREFIX}${job.id}`, JSON.stringify(job));
}

export function readClientDocument(documentId: string) {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}${documentId}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredDocumentJob;
  } catch {
    localStorage.removeItem(`${STORAGE_PREFIX}${documentId}`);
    return null;
  }
}

export function patchClientSection(
  job: StoredDocumentJob,
  sectionId: string,
  patch: SectionPatch,
): StoredDocumentJob {
  if (!job.reviewDocument) return job;

  const reviewDocument = applySectionPatch(job.reviewDocument, sectionId, patch);
  return {
    ...job,
    updatedAt: reviewDocument.updatedAt,
    reviewDocument,
  };
}

export function createDemoDocument(file: {
  name: string;
  type: string;
  size: number;
}) {
  const id = `demo-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const diagramIR: DiagramIR = {
    title: "Document conversion workflow",
    nodes: [
      { id: "upload", label: "Upload document", kind: "terminator" },
      { id: "extract", label: "Extract content", kind: "process" },
      { id: "review", label: "Human review", kind: "decision" },
      { id: "export", label: "Export Markdown", kind: "terminator" },
    ],
    edges: [
      { id: "e1", from: "upload", to: "extract" },
      { id: "e2", from: "extract", to: "review" },
      { id: "e3", from: "review", to: "export", label: "Approved" },
      { id: "e4", from: "review", to: "extract", label: "Revise" },
    ],
    groups: [],
    unclearNotes: [],
    confidence: 0.9,
  };
  const mermaid = diagramIRToMermaid(diagramIR);
  // The demo flow never inspects file bytes, so an unrecognized name/MIME
  // combination (e.g. no extension) falls back to "pdf" here explicitly,
  // rather than detectSourceFileType silently guessing.
  const sourceFileType = detectSourceFileType(file.name, file.type) ?? "pdf";

  return {
    id,
    status: "ready",
    sourceFileName: file.name,
    sourceFileType,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    createdAt: now,
    updatedAt: now,
    originalPath: "",
    reviewDocument: {
      id,
      title: `${file.name} demo conversion`,
      sourceFileName: file.name,
      sourceFileType,
      createdAt: now,
      updatedAt: now,
      sections: [
        {
          id: "sec_demo_summary_1",
          type: "paragraph",
          title: "Document summary",
          sourcePage: 1,
          originalText: `Selected source: ${file.name}`,
          generatedMarkdown:
            "This hosted demo shows how Docutor structures source material into reviewable Markdown sections.",
          reviewStatus: "pending",
        },
        {
          id: "sec_demo_requirements_2",
          type: "requirement",
          title: "Key requirements",
          sourcePage: 1,
          originalText: "Review extracted requirements before export.",
          generatedMarkdown:
            "- Preserve the source meaning.\n- Keep ambiguous details visible.\n- Require human approval before export.",
          reviewStatus: "pending",
        },
        {
          id: "sec_demo_workflow_3",
          type: "diagram",
          title: "Document conversion workflow",
          sourcePage: 1,
          originalText:
            "Upload → extraction → human review → Markdown export.",
          sourceImage: "",
          generatedMarkdown: `\`\`\`mermaid\n${mermaid}\n\`\`\``,
          reviewStatus: "pending",
          format: "mermaid",
          generatedCode: mermaid,
          diagramIR,
        },
      ],
      assets: [],
      warnings: [
        "Demo mode uses representative content and does not upload the selected file.",
      ],
    },
  } satisfies StoredDocumentJob;
}

export async function buildClientExport(
  job: StoredDocumentJob,
  kind: "markdown" | "zip",
) {
  if (!job.reviewDocument) {
    throw new Error("Review document not found.");
  }

  const markdown = renderReviewDocumentMarkdown(job.reviewDocument);
  if (kind === "markdown") {
    return {
      blob: new Blob([markdown], { type: "text/markdown;charset=utf-8" }),
      fileName: "document.md",
    };
  }

  const zip = new JSZip();
  zip.file("document.md", markdown);
  zip.file("manifest.json", JSON.stringify(buildExportManifest(job), null, 2));

  for (const diagramFile of collectDiagramExports(job.reviewDocument)) {
    zip.file(diagramFile.path, diagramFile.content);
  }

  return {
    blob: await zip.generateAsync({ type: "blob" }),
    fileName: "docutor-export.zip",
  };
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

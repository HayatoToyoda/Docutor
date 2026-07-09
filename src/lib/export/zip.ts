import path from "node:path";
import JSZip from "jszip";
import {
  buildAgentDocumentJson,
  buildAgentSectionsJsonl,
  buildExportManifest,
  collectDiagramExports,
} from "@/lib/document-model";
import { renderReviewDocumentMarkdown } from "@/lib/export/markdown";
import {
  getDocumentRepository,
  type DocumentRepository,
} from "@/lib/server/document-repository";
import type { StoredDocumentJob } from "@/lib/types";

function safeAssetName(assetPath: string, index: number) {
  const baseName = path.basename(assetPath).replace(/[^a-zA-Z0-9._-]/g, "_");
  return baseName || `asset-${index}`;
}

export async function buildDocumentZip(
  job: StoredDocumentJob,
  repository: DocumentRepository = getDocumentRepository(),
) {
  if (!job.reviewDocument) {
    throw new Error("Review document not found.");
  }

  const zip = new JSZip();
  const markdown = renderReviewDocumentMarkdown(job.reviewDocument);
  zip.file("document.md", markdown);
  zip.file("manifest.json", JSON.stringify(buildExportManifest(job), null, 2));

  for (const [index, asset] of job.reviewDocument.assets.entries()) {
    // readAsset returns null both for a missing file and for a path that
    // escapes this document's storage scope (containment is enforced by
    // the repository implementation) — the ZIP export treats both the same
    // way: a `.missing.txt` placeholder instead of failing the export.
    const data = await repository.readAsset(job.id, asset.path);
    if (data) {
      zip.file(`assets/${safeAssetName(asset.path, index + 1)}`, data);
    } else {
      zip.file(
        `assets/${safeAssetName(asset.path, index + 1)}.missing.txt`,
        `Asset could not be read from ${asset.path}\n`,
      );
    }
  }

  for (const diagramFile of collectDiagramExports(job.reviewDocument)) {
    zip.file(diagramFile.path, diagramFile.content);
  }

  zip.file("agent/sections.jsonl", buildAgentSectionsJsonl(job.reviewDocument));
  zip.file(
    "agent/document.json",
    JSON.stringify(buildAgentDocumentJson(job), null, 2),
  );

  return zip.generateAsync({ type: "nodebuffer" });
}

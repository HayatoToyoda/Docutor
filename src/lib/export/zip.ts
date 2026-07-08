import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { buildExportManifest, collectDiagramExports } from "@/lib/document-model";
import { renderReviewDocumentMarkdown } from "@/lib/export/markdown";
import type { StoredDocumentJob } from "@/lib/types";

function safeAssetName(assetPath: string, index: number) {
  const baseName = path.basename(assetPath).replace(/[^a-zA-Z0-9._-]/g, "_");
  return baseName || `asset-${index}`;
}

export async function buildDocumentZip(job: StoredDocumentJob) {
  if (!job.reviewDocument) {
    throw new Error("Review document not found.");
  }

  const zip = new JSZip();
  const markdown = renderReviewDocumentMarkdown(job.reviewDocument);
  zip.file("document.md", markdown);
  zip.file("manifest.json", JSON.stringify(buildExportManifest(job), null, 2));

  for (const [index, asset] of job.reviewDocument.assets.entries()) {
    try {
      const data = await readFile(asset.path);
      zip.file(`assets/${safeAssetName(asset.path, index + 1)}`, data);
    } catch {
      zip.file(
        `assets/${safeAssetName(asset.path, index + 1)}.missing.txt`,
        `Asset could not be read from ${asset.path}\n`,
      );
    }
  }

  for (const diagramFile of collectDiagramExports(job.reviewDocument)) {
    zip.file(diagramFile.path, diagramFile.content);
  }

  return zip.generateAsync({ type: "nodebuffer" });
}

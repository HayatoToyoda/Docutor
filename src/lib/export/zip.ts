import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { stripMermaidFence } from "@/lib/diagrams/diagram-ir";
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
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        id: job.id,
        sourceFileName: job.sourceFileName,
        sourceFileType: job.sourceFileType,
        status: job.status,
        exportedAt: new Date().toISOString(),
        acceptedSectionIds: job.reviewDocument.sections
          .filter((section) => section.reviewStatus === "accepted")
          .map((section) => section.id),
        assets: job.reviewDocument.assets,
      },
      null,
      2,
    ),
  );

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

  for (const section of job.reviewDocument.sections) {
    if (section.type !== "diagram") {
      continue;
    }

    if (section.format === "mermaid" && section.generatedCode) {
      zip.file(
        `diagrams/${section.id}.mmd`,
        stripMermaidFence(section.generatedCode),
      );
    }

    if (section.drawioXml) {
      zip.file(`diagrams/${section.id}.drawio`, section.drawioXml);
    }
  }

  return zip.generateAsync({ type: "nodebuffer" });
}

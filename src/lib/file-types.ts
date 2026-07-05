import path from "node:path";
import type { SourceFileType } from "./types";

const MIME_TYPES: Record<string, SourceFileType> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "image/png": "image",
  "image/jpeg": "image",
};

const EXTENSIONS: Record<string, SourceFileType> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".pptx": "pptx",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
};

export function detectSourceFileType(
  fileName: string,
  mimeType?: string,
): SourceFileType | null {
  if (mimeType && MIME_TYPES[mimeType]) {
    return MIME_TYPES[mimeType];
  }

  return EXTENSIONS[path.extname(fileName).toLowerCase()] ?? null;
}

export function sourceFileExtension(fileName: string): string {
  return path.extname(fileName).toLowerCase();
}

export function isSupportedSourceFile(fileName: string, mimeType?: string) {
  return detectSourceFileType(fileName, mimeType) !== null;
}

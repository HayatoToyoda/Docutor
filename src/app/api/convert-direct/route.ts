import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { detectSourceFileType } from "@/lib/file-types";
import {
  convertFileWithOpenAI,
  OpenAIProviderError,
} from "@/lib/llm/openai-provider";
import { jsonError } from "@/lib/server/http";
import type { StoredDocumentJob } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export const MAX_DIRECT_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return jsonError("Upload a document using the `file` form field.");
  }

  if (file.size > MAX_DIRECT_UPLOAD_BYTES) {
    return jsonError("File is too large. The hosted demo limit is 4 MB.", 413);
  }

  const sourceFileType = detectSourceFileType(file.name, file.type);

  if (!sourceFileType) {
    return jsonError(
      "Unsupported file type. Upload PDF, DOCX, PPTX, PNG, or JPG.",
    );
  }

  const id = `direct-${randomUUID()}`;
  const now = new Date().toISOString();

  try {
    const reviewDocument = await convertFileWithOpenAI({
      id,
      sourceFileName: file.name,
      fileType: sourceFileType,
      mimeType: file.type || "application/octet-stream",
      data: Buffer.from(await file.arrayBuffer()),
    });
    const document: StoredDocumentJob = {
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
        ...reviewDocument,
        assets: [],
      },
    };

    return NextResponse.json({ document });
  } catch (error) {
    console.error(error);
    const message =
      error instanceof OpenAIProviderError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Conversion failed.";
    return jsonError(message, 500);
  }
}
